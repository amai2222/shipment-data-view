-- ============================================================================
-- 创建自定义验重函数
-- ============================================================================
-- 功能：支持用户自定义选择验重字段进行重复检查
-- 参数：
--   p_records: 要检查的记录数组（JSONB）
--   p_check_fields: 要用于验重的字段数组（TEXT[]），例如：['project_name', 'driver_name', 'loading_date']
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_import_with_custom_duplicate_check(
    p_records jsonb,
    p_check_fields text[] DEFAULT ARRAY['project_name', 'driver_name', 'license_plate', 'loading_location', 'unloading_location', 'loading_date', 'loading_weight']
)
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
    processed_record jsonb;
    project_id_val uuid;
    chain_id_val uuid;
    chain_name_val text;
    loading_date_formatted text;
    loading_date_china timestamptz;
    check_field text;
    where_conditions text := '';
    field_value text;
    field_condition text;
BEGIN
    -- 验证至少选择一个字段
    IF array_length(p_check_fields, 1) IS NULL OR array_length(p_check_fields, 1) = 0 THEN
        RETURN jsonb_build_object(
            'error', '至少需要选择一个验重字段',
            'new_records', '[]'::jsonb,
            'update_records', '[]'::jsonb,
            'error_records', '[]'::jsonb
        );
    END IF;

    -- 遍历每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 1. 基本字段验证（至少需要项目名称、司机姓名、车牌号）
            IF NOT (record_data ? 'project_name' AND record_data ? 'driver_name' AND 
                   record_data ? 'license_plate') THEN
                error_records_json := error_records_json || jsonb_build_object(
                    'record', record_data,
                    'error', '缺少必填字段（项目名称、司机姓名、车牌号）'
                );
                CONTINUE;
            END IF;

            -- 2. 获取项目ID
            SELECT id INTO project_id_val 
            FROM public.projects 
            WHERE UPPER(TRIM(name)) = UPPER(TRIM(record_data->>'project_name'))
            LIMIT 1;

            IF project_id_val IS NULL THEN
                error_records_json := error_records_json || jsonb_build_object(
                    'record', record_data,
                    'error', '项目不存在'
                );
                CONTINUE;
            END IF;

            -- 3. 获取链路ID（如果选择了 chain_name 字段）
            IF 'chain_name' = ANY(p_check_fields) THEN
                chain_name_val := TRIM(record_data->>'chain_name');
                IF chain_name_val IS NOT NULL AND chain_name_val != '' THEN
                    SELECT id INTO chain_id_val 
                    FROM public.partner_chains 
                    WHERE chain_name = chain_name_val AND project_id = project_id_val;
                ELSE
                    chain_id_val := NULL;
                END IF;
            END IF;

            -- 4. 日期处理（如果选择了日期字段）
            IF 'loading_date' = ANY(p_check_fields) OR 'unloading_date' = ANY(p_check_fields) THEN
                loading_date_formatted := TRIM(record_data->>'loading_date');
                loading_date_china := (loading_date_formatted || ' 00:00:00+08:00')::timestamptz;
            END IF;

            -- 5. 构建重复检查查询（不使用动态SQL，更安全）
            -- 必须使用 project_id 和 driver_id 来匹配（通过 JOIN）
            -- 其他字段根据用户选择动态添加条件
            
            SELECT lr.id, lr.auto_number
            INTO existing_record_id, existing_auto_number
            FROM public.logistics_records lr
            JOIN public.projects p ON UPPER(TRIM(p.name)) = UPPER(TRIM(record_data->>'project_name'))
            JOIN public.drivers d ON UPPER(TRIM(d.name)) = UPPER(TRIM(record_data->>'driver_name'))
                AND UPPER(TRIM(d.license_plate)) = UPPER(TRIM(record_data->>'license_plate'))
            WHERE lr.project_id = p.id
            AND lr.driver_id = d.id
            -- 根据用户选择的字段动态添加条件
            AND (
                -- chain_name: 如果选择了此字段，检查 chain_id
                CASE 
                    WHEN 'chain_name' = ANY(p_check_fields) THEN
                        (lr.chain_id = chain_id_val OR (lr.chain_id IS NULL AND chain_id_val IS NULL))
                    ELSE TRUE
                END
            )
            AND (
                -- loading_location: 如果选择了此字段，检查装货地点
                CASE 
                    WHEN 'loading_location' = ANY(p_check_fields) THEN
                        UPPER(TRIM(lr.loading_location)) = UPPER(TRIM(record_data->>'loading_location'))
                    ELSE TRUE
                END
            )
            AND (
                -- unloading_location: 如果选择了此字段，检查卸货地点
                CASE 
                    WHEN 'unloading_location' = ANY(p_check_fields) THEN
                        UPPER(TRIM(lr.unloading_location)) = UPPER(TRIM(record_data->>'unloading_location'))
                    ELSE TRUE
                END
            )
            AND (
                -- loading_date: 如果选择了此字段，检查装货日期（正确处理时区）
                CASE 
                    WHEN 'loading_date' = ANY(p_check_fields) THEN
                        (lr.loading_date AT TIME ZONE 'UTC' AT TIME ZONE '+08:00')::date = loading_date_formatted::date
                    ELSE TRUE
                END
            )
            AND (
                -- unloading_date: 如果选择了此字段，检查卸货日期（正确处理时区）
                CASE 
                    WHEN 'unloading_date' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'unloading_date' IS NULL OR TRIM(record_data->>'unloading_date') = '' THEN
                                lr.unloading_date IS NULL
                            ELSE
                                (lr.unloading_date AT TIME ZONE 'UTC' AT TIME ZONE '+08:00')::date = (TRIM(record_data->>'unloading_date'))::date
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- loading_weight: 如果选择了此字段，检查装货数量（数值比较，处理精度）
                CASE 
                    WHEN 'loading_weight' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'loading_weight' IS NULL OR TRIM(record_data->>'loading_weight') = '' THEN
                                lr.loading_weight IS NULL
                            ELSE
                                ROUND(COALESCE(lr.loading_weight, 0)::numeric, 2) = ROUND((record_data->>'loading_weight')::numeric, 2)
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- unloading_weight: 如果选择了此字段，检查卸货数量（数值比较，处理精度）
                CASE 
                    WHEN 'unloading_weight' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'unloading_weight' IS NULL OR TRIM(record_data->>'unloading_weight') = '' THEN
                                lr.unloading_weight IS NULL
                            ELSE
                                ROUND(COALESCE(lr.unloading_weight, 0)::numeric, 2) = ROUND((record_data->>'unloading_weight')::numeric, 2)
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- driver_phone: 如果选择了此字段，检查司机电话
                CASE 
                    WHEN 'driver_phone' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'driver_phone' IS NULL OR TRIM(record_data->>'driver_phone') = '' THEN
                                (lr.driver_phone IS NULL OR TRIM(lr.driver_phone) = '')
                            ELSE
                                UPPER(TRIM(lr.driver_phone)) = UPPER(TRIM(record_data->>'driver_phone'))
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- transport_type: 如果选择了此字段，检查运输类型
                CASE 
                    WHEN 'transport_type' = ANY(p_check_fields) THEN
                        COALESCE(UPPER(TRIM(lr.transport_type)), '') = COALESCE(UPPER(TRIM(record_data->>'transport_type')), '实际运输')
                    ELSE TRUE
                END
            )
            AND (
                -- cargo_type: 如果选择了此字段，检查货物类型
                CASE 
                    WHEN 'cargo_type' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'cargo_type' IS NULL OR TRIM(record_data->>'cargo_type') = '' THEN
                                (lr.cargo_type IS NULL OR TRIM(lr.cargo_type) = '')
                            ELSE
                                UPPER(TRIM(lr.cargo_type)) = UPPER(TRIM(record_data->>'cargo_type'))
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- current_cost: 如果选择了此字段，检查运费金额（数值比较）
                CASE 
                    WHEN 'current_cost' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'current_cost' IS NULL OR TRIM(record_data->>'current_cost') = '' THEN
                                (lr.current_cost IS NULL OR lr.current_cost = 0)
                            ELSE
                                ROUND(COALESCE(lr.current_cost, 0)::numeric, 2) = ROUND((record_data->>'current_cost')::numeric, 2)
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- extra_cost: 如果选择了此字段，检查额外费用（数值比较）
                CASE 
                    WHEN 'extra_cost' = ANY(p_check_fields) THEN
                        CASE 
                            WHEN record_data->>'extra_cost' IS NULL OR TRIM(record_data->>'extra_cost') = '' THEN
                                (lr.extra_cost IS NULL OR lr.extra_cost = 0)
                            ELSE
                                ROUND(COALESCE(lr.extra_cost, 0)::numeric, 2) = ROUND((record_data->>'extra_cost')::numeric, 2)
                        END
                    ELSE TRUE
                END
            )
            AND (
                -- external_tracking_numbers: 如果选择了此字段，检查其他平台运单编号（数组字段，有交集即视为重复）
                CASE 
                    WHEN 'external_tracking_numbers' = ANY(p_check_fields) THEN
                        CASE 
                            -- 如果前端传递的是空数组或NULL，检查数据库中的值是否也为空
                            WHEN record_data->'external_tracking_numbers' IS NULL 
                                 OR jsonb_array_length(COALESCE(record_data->'external_tracking_numbers', '[]'::jsonb)) = 0 THEN
                                (lr.external_tracking_numbers IS NULL OR array_length(lr.external_tracking_numbers, 1) IS NULL)
                            ELSE
                                -- 将前端传递的 JSONB 数组转换为 TEXT[] 数组，然后检查是否有交集
                                -- 使用 && 操作符检查数组是否有交集（只要有一个相同的元素就认为是重复）
                                lr.external_tracking_numbers && (
                                    SELECT array_agg(value::text)
                                    FROM jsonb_array_elements_text(record_data->'external_tracking_numbers')
                                    WHERE value::text != ''
                                )
                        END
                    ELSE TRUE
                END
            )
            LIMIT 1;

            -- 7. 构建处理后的记录
            processed_record := jsonb_build_object(
                'project_name', TRIM(record_data->>'project_name'),
                'chain_name', COALESCE(TRIM(record_data->>'chain_name'), ''),
                'driver_name', TRIM(record_data->>'driver_name'),
                'license_plate', TRIM(record_data->>'license_plate'),
                'driver_phone', COALESCE(TRIM(record_data->>'driver_phone'), ''),
                'loading_location', TRIM(record_data->>'loading_location'),
                'unloading_location', TRIM(record_data->>'unloading_location'),
                'loading_date', record_data->>'loading_date',
                'unloading_date', record_data->>'unloading_date',
                'loading_weight', record_data->>'loading_weight',
                'unloading_weight', record_data->>'unloading_weight',
                'current_cost', record_data->>'current_cost',
                'extra_cost', record_data->>'extra_cost',
                'transport_type', COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                'cargo_type', COALESCE(TRIM(record_data->>'cargo_type'), ''),
                'remarks', COALESCE(TRIM(record_data->>'remarks'), ''),
                'external_tracking_numbers', record_data->'external_tracking_numbers',
                'other_platform_names', record_data->'other_platform_names'
            );

            -- 8. 分类记录
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

    -- 9. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'update_records', update_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 添加注释说明
COMMENT ON FUNCTION public.preview_import_with_custom_duplicate_check(jsonb, text[]) IS 
'自定义验重函数：支持用户选择验重字段进行重复检查。
参数：
  p_records: 要检查的记录数组（JSONB）
  p_check_fields: 要用于验重的字段数组（TEXT[]），例如：[''project_name'', ''driver_name'', ''loading_date'']
  
默认字段：[''project_name'', ''driver_name'', ''license_plate'', ''loading_location'', ''unloading_location'', ''loading_date'', ''loading_weight'']

支持的字段：
  - project_name: 项目名称（通过 project_id 匹配）
  - chain_name: 合作链路（通过 chain_id 匹配）
  - driver_name: 司机姓名（通过 driver_id 匹配）
  - license_plate: 车牌号（通过 driver_id 匹配）
  - driver_phone: 司机电话
  - loading_location: 装货地点
  - unloading_location: 卸货地点
  - loading_date: 装货日期（正确处理时区转换）
  - unloading_date: 卸货日期（正确处理时区转换）
  - loading_weight: 装货数量（数值比较，处理精度）
  - unloading_weight: 卸货数量（数值比较，处理精度）
  - transport_type: 运输类型
  - cargo_type: 货物类型
  - current_cost: 运费金额（数值比较）
  - extra_cost: 额外费用（数值比较）
  - external_tracking_numbers: 其他平台运单编号（数组字段，有交集即视为重复）';

-- 完成提示
SELECT '✅ 自定义验重函数已创建：preview_import_with_custom_duplicate_check' AS status;

