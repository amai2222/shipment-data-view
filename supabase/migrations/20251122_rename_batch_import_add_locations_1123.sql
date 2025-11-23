-- ============================================================================
-- 重命名批量导入函数并添加地点自动创建和项目关联
-- ============================================================================
-- 功能：
-- 1. 将 batch_import_logistics_records_with_update 重命名为 batch_import_logistics_records_with_update_1123
-- 2. 添加装货地点和卸货地点自动插入到 locations 表的功能
-- 3. 添加地点到项目的自动关联功能
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_import_logistics_records_with_update_1123(
    p_records jsonb,
    p_update_mode boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_ids uuid[] := ARRAY[]::uuid[];
    v_updated_ids uuid[] := ARRAY[]::uuid[];
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_insert_count integer := 0;
    v_update_count integer := 0;
    v_error_details jsonb := '[]'::jsonb;
    v_record_index integer := 0;
    record_data jsonb;
    existing_record_id uuid;
    chain_id_val uuid;
    project_id_val uuid;
    driver_id_val uuid;
    loading_location_id uuid;
    unloading_location_id uuid;
    auto_number_val text;
    inserted_record_id uuid;
    v_external_tracking_numbers text[];
    v_other_platform_names text[];
    v_loading_date_formatted text;
    v_unloading_date_formatted text;
    v_duplicate_check_results jsonb := '{}'::jsonb;
    v_check_key text;
    v_check_result jsonb;
BEGIN
    -- ============================================================================
    -- 第一阶段：批量查询所有记录的重复情况（性能优化）
    -- ============================================================================
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        v_check_key := v_record_index::text;
        
        BEGIN
            SELECT lr.id, lr.auto_number INTO existing_record_id, auto_number_val
            FROM public.logistics_records lr
            JOIN public.projects p ON p.name = TRIM(record_data->>'project_name')
            JOIN public.drivers d ON d.name = TRIM(record_data->>'driver_name') AND d.license_plate = TRIM(record_data->>'license_plate')
            WHERE lr.project_id = p.id
              AND lr.driver_id = d.id
              AND lr.loading_location = TRIM(record_data->>'loading_location')
              AND lr.unloading_location = TRIM(record_data->>'unloading_location')
              AND (lr.loading_date AT TIME ZONE 'UTC')::date = (TRIM(record_data->>'loading_date'))::date
              AND (COALESCE((lr.loading_weight)::text, '') = COALESCE(NULLIF(TRIM(record_data->>'loading_weight'), ''), ''))
              AND (COALESCE((lr.unloading_weight)::text, '') = COALESCE(NULLIF(TRIM(record_data->>'unloading_weight'), ''), ''))
              AND (COALESCE(lr.transport_type, '') = COALESCE(NULLIF(TRIM(record_data->>'transport_type'), ''), ''))
            LIMIT 1;
            
            v_duplicate_check_results := v_duplicate_check_results || jsonb_build_object(
                v_check_key, 
                jsonb_build_object(
                    'existing_record_id', existing_record_id,
                    'existing_auto_number', auto_number_val
                )
            );
        EXCEPTION WHEN OTHERS THEN
            v_duplicate_check_results := v_duplicate_check_results || jsonb_build_object(
                v_check_key,
                jsonb_build_object('existing_record_id', null, 'existing_auto_number', null)
            );
        END;
    END LOOP;

    -- ============================================================================
    -- 第二阶段：遍历所有记录，执行插入或更新操作
    -- ============================================================================
    v_record_index := 0;
    
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        v_check_key := v_record_index::text;
        v_check_result := v_duplicate_check_results->v_check_key;
        
        existing_record_id := (v_check_result->>'existing_record_id')::uuid;
        
        BEGIN
            SELECT id INTO project_id_val FROM public.projects WHERE name = TRIM(record_data->>'project_name') LIMIT 1;
            SELECT id INTO driver_id_val FROM public.drivers WHERE name = TRIM(record_data->>'driver_name') AND license_plate = TRIM(record_data->>'license_plate') LIMIT 1;
            SELECT id INTO chain_id_val FROM public.partner_chains WHERE chain_name = TRIM(record_data->>'chain_name') AND project_id = project_id_val LIMIT 1;

            -- ✅ 新增：查找或创建装货地点
            SELECT id INTO loading_location_id
            FROM public.locations
            WHERE name = TRIM(record_data->>'loading_location')
            LIMIT 1;
            
            IF loading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES (TRIM(record_data->>'loading_location'), auth.uid())
                RETURNING id INTO loading_location_id;
            END IF;
            
            -- ✅ 新增：查找或创建卸货地点
            SELECT id INTO unloading_location_id
            FROM public.locations
            WHERE name = TRIM(record_data->>'unloading_location')
            LIMIT 1;
            
            IF unloading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES (TRIM(record_data->>'unloading_location'), auth.uid())
                RETURNING id INTO unloading_location_id;
            END IF;
            
            -- ✅ 新增：关联地点到项目
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            VALUES (loading_location_id, project_id_val, auth.uid())
            ON CONFLICT (location_id, project_id) DO NOTHING;
            
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            VALUES (unloading_location_id, project_id_val, auth.uid())
            ON CONFLICT (location_id, project_id) DO NOTHING;

            -- ✅ 日期处理：读取Excel的日期，然后转换为UTC存入数据库（与模板导入保持一致）
            -- 流程：
            -- 1. Excel中的日期：2025-01-15（中国时区日期）
            -- 2. 前端解析后传递：'2025-01-15'（YYYY-MM-DD格式字符串，代表中国时区日期）
            -- 3. 后端转换：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00
            -- 4. 存储为UTC：PostgreSQL自动转换为UTC → 2025-01-14 16:00:00+00（UTC）
            v_loading_date_formatted := TRIM(record_data->>'loading_date');
            v_unloading_date_formatted := COALESCE(NULLIF(TRIM(record_data->>'unloading_date'), ''), v_loading_date_formatted);

            v_external_tracking_numbers := CASE 
                WHEN record_data->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(record_data->'external_tracking_numbers') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(record_data->'external_tracking_numbers') AS value WHERE value::text != '')
                ELSE '{}'::text[]
            END;

            v_other_platform_names := CASE 
                WHEN record_data->'other_platform_names' IS NOT NULL AND jsonb_array_length(record_data->'other_platform_names') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(record_data->'other_platform_names') AS value WHERE value::text != '')
                ELSE '{}'::text[]
            END;

            IF p_update_mode AND existing_record_id IS NOT NULL THEN
                UPDATE public.logistics_records SET
                    project_id = project_id_val,
                    chain_id = chain_id_val,
                    -- ✅ 将Excel读取的中国时区日期转换为UTC存储（与模板导入保持一致）
                    -- 示例：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00 → 2025-01-14 16:00:00+00 (UTC)
                    loading_date = (v_loading_date_formatted || ' 00:00:00+08:00')::timestamptz,
                    unloading_date = (v_unloading_date_formatted || ' 00:00:00+08:00')::timestamptz,
                    loading_weight = CASE WHEN record_data->>'loading_weight' IS NOT NULL AND TRIM(record_data->>'loading_weight') != '' THEN (record_data->>'loading_weight')::numeric ELSE NULL END,
                    unloading_weight = CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    transport_type = COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    current_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    extra_cost = CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    remarks = TRIM(record_data->>'remarks'),
                    external_tracking_numbers = v_external_tracking_numbers,
                    other_platform_names = v_other_platform_names
                WHERE id = existing_record_id;
                
                v_updated_ids := array_append(v_updated_ids, existing_record_id);
                v_update_count := v_update_count + 1;
            ELSIF existing_record_id IS NULL THEN
                auto_number_val := public.generate_auto_number(v_loading_date_formatted);
                
                INSERT INTO public.logistics_records (
                    auto_number, project_id, project_name, loading_date, loading_location, 
                    unloading_location, driver_id, driver_name, license_plate, driver_phone,
                    loading_weight, unloading_date, unloading_weight, transport_type, cargo_type,
                    current_cost, extra_cost, payable_cost, remarks, created_by_user_id,
                    chain_id, external_tracking_numbers, other_platform_names
                ) VALUES (
                    auto_number_val, 
                    project_id_val, 
                    TRIM(record_data->>'project_name'),
                    -- ✅ 将Excel读取的中国时区日期转换为UTC存储（与模板导入保持一致）
                    -- 示例：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00 → 2025-01-14 16:00:00+00 (UTC)
                    (v_loading_date_formatted || ' 00:00:00+08:00')::timestamptz,
                    TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), 
                    driver_id_val, 
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), 
                    TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
                    -- ✅ 将Excel读取的中国时区日期转换为UTC存储（与模板导入保持一致）
                    -- 示例：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00 → 2025-01-14 16:00:00+00 (UTC)
                    CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                         THEN (v_unloading_date_formatted || ' 00:00:00+08:00')::timestamptz ELSE NULL END,
                    CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                         THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    TRIM(record_data->>'cargo_type'),
                    CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                         THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    0, -- payable_cost 将在触发器中计算
                    TRIM(record_data->>'remarks'),
                    auth.uid(),
                    chain_id_val,
                    v_external_tracking_numbers,
                    v_other_platform_names
                )
                RETURNING id INTO inserted_record_id;

                v_inserted_ids := array_append(v_inserted_ids, inserted_record_id);
                v_insert_count := v_insert_count + 1;
            END IF;

            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_error_details := v_error_details || jsonb_build_object(
                'record_index', v_record_index,
                'error_message', SQLERRM,
                'record_data', record_data
            );
        END;
    END LOOP;

    -- ✅ 调用成本重算函数（与模板导入保持一致）
    IF array_length(v_inserted_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
    END IF;
    
    -- ✅ 对更新的记录也重新计算成本
    IF array_length(v_updated_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_updated_ids);
    END IF;

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'inserted_count', v_insert_count,
        'updated_count', v_update_count,
        'inserted_ids', v_inserted_ids,
        'updated_ids', v_updated_ids,
        'error_details', v_error_details
    );
END;
$$;

COMMENT ON FUNCTION public.batch_import_logistics_records_with_update_1123(jsonb, boolean) IS 
'批量导入运单记录，支持更新模式。
版本：1123
已修复：
1. 添加了合作方成本自动重算功能
2. 添加了地点自动创建功能（装货地点和卸货地点会自动插入到 locations 表）
3. 添加了地点到项目的自动关联功能';

-- 验证
SELECT '✅ 函数已创建：batch_import_logistics_records_with_update_1123，已添加地点自动创建和项目关联功能' AS status;

