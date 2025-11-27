-- ============================================================================
-- 修复 preview_import_with_update_mode 函数的日期比较逻辑
-- ============================================================================
-- 问题：日期比较时没有正确处理时区转换
-- 前端传递：'2025-11-13'（中国时区日期字符串）
-- 数据库存储：'2025-11-12 16:00:00+00'（UTC时间）
-- 错误比较：lr.loading_date::date = '2025-11-13'::date → 2025-11-12 = 2025-11-13 → false（错误！）
-- 正确比较：应该将数据库的UTC时间转换为中国时区日期，或使用日期范围比较
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_import_with_update_mode(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_records_json jsonb := '[]'::jsonb;
    update_records_json jsonb := '[]'::jsonb;
    error_records_json jsonb := '[]'::jsonb;
    record_data jsonb;
    existing_record_id uuid;
    existing_auto_number text;
    is_duplicate boolean;
    processed_record jsonb;
    project_id_val uuid;
    chain_id_val uuid;
    chain_name_val text;
    loading_date_formatted text;
    loading_date_china timestamptz;  -- 中国时区的日期时间戳
BEGIN
    -- 遍历每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 1. 基本字段验证
            IF NOT (record_data ? 'project_name' AND record_data ? 'driver_name' AND 
                   record_data ? 'license_plate' AND record_data ? 'loading_location' AND 
                   record_data ? 'unloading_location' AND record_data ? 'loading_date' AND 
                   record_data ? 'loading_weight') THEN
                error_records_json := error_records_json || jsonb_build_object(
                    'record', record_data,
                    'error', '缺少必填字段'
                );
                CONTINUE;
            END IF;

            -- 2. 获取项目ID
            SELECT id INTO project_id_val 
            FROM public.projects 
            WHERE name = TRIM(record_data->>'project_name')
            LIMIT 1;

            IF project_id_val IS NULL THEN
                error_records_json := error_records_json || jsonb_build_object(
                    'record', record_data,
                    'error', '项目不存在'
                );
                CONTINUE;
            END IF;

            -- 3. 获取链路ID
            chain_name_val := TRIM(record_data->>'chain_name');
            IF chain_name_val IS NOT NULL AND chain_name_val != '' THEN
                SELECT id INTO chain_id_val 
                FROM public.partner_chains 
                WHERE chain_name = chain_name_val AND project_id = project_id_val;
            ELSE
                chain_id_val := NULL;
            END IF;

            -- 4. ✅ 修复：日期处理 - 将前端传递的中国时区日期字符串转换为timestamptz
            -- 前端传递：'2025-11-13'（中国时区日期）
            -- 转换为：'2025-11-13 00:00:00+08:00'（中国时区时间戳）
            loading_date_formatted := TRIM(record_data->>'loading_date');
            loading_date_china := (loading_date_formatted || ' 00:00:00+08:00')::timestamptz;

            -- 5. ✅ 修复：检查是否存在重复记录（基于6个关键字段）
            -- ✅ 重要：使用 project_id 和 driver_id 来匹配，而不是直接比较 project_name 和 driver_name
            -- 这样可以确保即使项目名称或司机名称有变化，也能正确匹配
            -- 只检查6个关键字段：project_id, driver_id, loading_location, unloading_location, loading_date, loading_weight
            SELECT 
                lr.id,
                lr.auto_number
            INTO existing_record_id, existing_auto_number
            FROM public.logistics_records lr
            -- ✅ 使用 TRIM 和 UPPER 确保项目名称匹配（处理空格和大小写）
            JOIN public.projects p ON UPPER(TRIM(p.name)) = UPPER(TRIM(record_data->>'project_name'))
            -- ✅ 使用 TRIM 和 UPPER 确保司机信息匹配（处理空格和大小写）
            JOIN public.drivers d ON UPPER(TRIM(d.name)) = UPPER(TRIM(record_data->>'driver_name'))
                AND UPPER(TRIM(d.license_plate)) = UPPER(TRIM(record_data->>'license_plate'))
            WHERE lr.project_id = p.id
            AND lr.driver_id = d.id
            -- ✅ 使用 TRIM 和 UPPER 去除空格和大小写差异，确保地点匹配
            AND UPPER(TRIM(lr.loading_location)) = UPPER(TRIM(record_data->>'loading_location'))
            AND UPPER(TRIM(lr.unloading_location)) = UPPER(TRIM(record_data->>'unloading_location'))
            -- ✅ 修复：使用正确的日期比较
            -- 前端传递：'2025-11-13'（中国时区日期字符串）
            -- 数据库存储：'2025-11-12 16:00:00+00' (UTC) - 代表中国时区的 '2025-11-13 00:00:00+08:00'
            -- 正确逻辑：将数据库UTC时间转换为中国时区日期，与前端日期比较
            --   (lr.loading_date AT TIME ZONE 'UTC' AT TIME ZONE '+08:00')::date = '2025-11-13'::date
            --   → '2025-11-13' = '2025-11-13' → true（正确！）
            AND (lr.loading_date AT TIME ZONE 'UTC' AT TIME ZONE '+08:00')::date = loading_date_formatted::date
            -- ✅ 使用数值比较 loading_weight，处理空值和格式差异
            -- 如果前端传递的是空字符串或NULL，检查数据库中的值是否为NULL
            -- 否则转换为数值进行比较
            AND (
                CASE 
                    WHEN record_data->>'loading_weight' IS NULL OR TRIM(record_data->>'loading_weight') = '' THEN
                        lr.loading_weight IS NULL
                    ELSE
                        -- 使用 ROUND 处理浮点数精度问题
                        ROUND(COALESCE(lr.loading_weight, 0)::numeric, 2) = ROUND((record_data->>'loading_weight')::numeric, 2)
                END
            )
            LIMIT 1;

            -- 6. 构建处理后的记录，包含所有字段
            processed_record := jsonb_build_object(
                'project_name', TRIM(record_data->>'project_name'),
                'chain_name', TRIM(record_data->>'chain_name'),
                'driver_name', TRIM(record_data->>'driver_name'),
                'license_plate', TRIM(record_data->>'license_plate'),
                'driver_phone', TRIM(record_data->>'driver_phone'),
                'loading_location', TRIM(record_data->>'loading_location'),
                'unloading_location', TRIM(record_data->>'unloading_location'),
                'loading_date', record_data->>'loading_date',
                'unloading_date', record_data->>'unloading_date',
                'loading_weight', record_data->>'loading_weight',
                'unloading_weight', record_data->>'unloading_weight',
                'current_cost', record_data->>'current_cost',
                'extra_cost', record_data->>'extra_cost',
                'transport_type', record_data->>'transport_type',
                'cargo_type', record_data->>'cargo_type',
                'remarks', record_data->>'remarks',
                'external_tracking_numbers', record_data->'external_tracking_numbers',
                'other_platform_names', record_data->'other_platform_names'
            );

            -- 7. 分类记录
            IF existing_record_id IS NOT NULL THEN
                -- 存在重复记录，标记为更新
                update_records_json := update_records_json || jsonb_build_object(
                    'record', processed_record,
                    'existing_record_id', existing_record_id,
                    'existing_auto_number', existing_auto_number
                );
            ELSE
                -- 不存在重复记录，标记为新记录
                new_records_json := new_records_json || jsonb_build_object('record', processed_record);
            END IF;

        EXCEPTION WHEN OTHERS THEN
            error_records_json := error_records_json || jsonb_build_object(
                'record', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 8. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'update_records', update_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 添加注释说明
COMMENT ON FUNCTION public.preview_import_with_update_mode(jsonb) IS 
'预览导入数据，支持更新模式分类，返回新记录和重复记录。
已修复日期比较逻辑：正确处理中国时区日期与UTC时间的转换。';

-- 完成提示
SELECT '✅ preview_import_with_update_mode 函数已修复：日期比较逻辑已正确处理时区转换' AS status;

