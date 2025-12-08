-- ============================================================================
-- 为批量导入函数添加全局异常处理，避免 500 错误
-- ============================================================================
-- 问题：当函数在执行过程中遇到未捕获的异常时（如成本重算函数失败），
--       会导致整个函数返回 500 错误，而不是返回包含错误详情的 JSONB 结果
-- 解决：添加全局 EXCEPTION 处理，确保所有错误都能被捕获并返回给前端
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_import_logistics_records_with_update_1208(
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
    v_billing_type_id bigint;
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
            
            -- ✅ 修复：查找或创建司机
            SELECT id INTO driver_id_val 
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name') 
            AND license_plate = TRIM(record_data->>'license_plate') 
            LIMIT 1;
            
            -- 如果司机不存在，创建新司机
            IF driver_id_val IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id INTO driver_id_val;
                
                -- ✅ 关联司机到项目
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (driver_id_val, project_id_val, auth.uid())
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END IF;
            
            -- ✅ 修复：在获取 chain_id 时同时获取 billing_type_id
            chain_id_val := NULL;
            v_billing_type_id := 1;  -- 默认值为1（计吨）
            
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id, COALESCE(billing_type_id, 1) INTO chain_id_val, v_billing_type_id
                FROM public.partner_chains 
                WHERE chain_name = TRIM(record_data->>'chain_name') 
                AND project_id = project_id_val 
                LIMIT 1;
            END IF;

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

            -- ✅ 日期处理：读取Excel的日期，然后转换为UTC存入数据库
            v_loading_date_formatted := NULLIF(TRIM(record_data->>'loading_date'), '');
            IF v_loading_date_formatted IS NULL OR v_loading_date_formatted = '' THEN
                RAISE EXCEPTION '装货日期不能为空';
            END IF;
            -- ✅ 标准化日期格式：将 '2025-12-4' 转换为 '2025-12-04'
            v_loading_date_formatted := to_char(to_date(v_loading_date_formatted, 'YYYY-MM-DD'), 'YYYY-MM-DD');
            v_unloading_date_formatted := COALESCE(NULLIF(TRIM(record_data->>'unloading_date'), ''), v_loading_date_formatted);
            IF v_unloading_date_formatted IS NOT NULL AND v_unloading_date_formatted != '' THEN
                v_unloading_date_formatted := to_char(to_date(v_unloading_date_formatted, 'YYYY-MM-DD'), 'YYYY-MM-DD');
            END IF;

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
                    billing_type_id = v_billing_type_id,
                    loading_date = ((v_loading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz,
                    unloading_date = CASE 
                        WHEN v_unloading_date_formatted IS NOT NULL AND v_unloading_date_formatted != '' 
                        THEN ((v_unloading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz 
                        ELSE NULL 
                    END,
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
                    chain_id, billing_type_id, external_tracking_numbers, other_platform_names
                ) VALUES (
                    auto_number_val, 
                    project_id_val, 
                    TRIM(record_data->>'project_name'),
                    ((v_loading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz,
                    TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), 
                    driver_id_val, 
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), 
                    TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
                    CASE WHEN v_unloading_date_formatted IS NOT NULL AND v_unloading_date_formatted != '' 
                         THEN ((v_unloading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz ELSE NULL END,
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
                    v_billing_type_id,
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
    -- ✅ 修复：添加异常处理，避免成本重算失败导致整个函数返回 500 错误
    BEGIN
        IF array_length(v_inserted_ids, 1) > 0 THEN
            PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
        END IF;
        
        IF array_length(v_updated_ids, 1) > 0 THEN
            PERFORM public.recalculate_and_update_costs_for_records(v_updated_ids);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- 成本重算失败不影响导入结果，但记录到错误详情中
        v_error_details := v_error_details || jsonb_build_object(
            'record_index', -1,  -- 使用 -1 表示这是全局错误，不是单条记录的错误
            'error_message', '成本重算失败: ' || SQLERRM,
            'record_data', jsonb_build_object('note', '这是成本重算阶段的错误，不影响已导入的记录')
        );
        RAISE NOTICE '成本重算失败: %', SQLERRM;
    END;

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

-- ✅ 新增：全局异常处理，确保所有未捕获的异常都能返回错误详情而不是 500 错误
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '批量导入函数发生未捕获的异常: %', SQLERRM;
    RAISE NOTICE '错误堆栈: %', SQLSTATE;
    
    -- 返回包含错误信息的 JSONB 结果，而不是抛出异常
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count + 1,
        'inserted_count', v_insert_count,
        'updated_count', v_update_count,
        'inserted_ids', COALESCE(v_inserted_ids, ARRAY[]::uuid[]),
        'updated_ids', COALESCE(v_updated_ids, ARRAY[]::uuid[]),
        'error_details', v_error_details || jsonb_build_array(
            jsonb_build_object(
                'record_index', -1,
                'error_message', '函数执行失败: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
                'record_data', jsonb_build_object('note', '这是函数级别的错误，可能影响所有记录的处理')
            )
        )
    );
END;
$$;

COMMENT ON FUNCTION public.batch_import_logistics_records_with_update_1208(jsonb, boolean) IS 
'批量导入运单记录，支持更新模式。
版本：1208
已修复：
1. 添加了合作方成本自动重算功能
2. 添加了地点自动创建功能（装货地点和卸货地点会自动插入到 locations 表）
3. 添加了地点到项目的自动关联功能
4. ✅ 新增：在获取 chain_id 时同时获取 billing_type_id，并在插入和更新时设置它
5. ✅ 新增：添加全局异常处理，避免返回 500 错误，所有错误都会返回包含错误详情的 JSONB 结果';

-- 验证
SELECT '✅ 函数已更新：batch_import_logistics_records_with_update_1208，已添加全局异常处理' AS status;
