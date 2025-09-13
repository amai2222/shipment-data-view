-- 修复运单导入时 payable_cost 字段计算问题
-- 这个脚本将修复 batch_import_logistics_records_with_update 函数

-- 1. 修复 INSERT 语句中的 payable_cost 计算
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records_with_update(
    p_records jsonb,
    p_update_mode boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_insert_count integer := 0;
    v_update_count integer := 0;
    v_inserted_ids uuid[] := '{}';
    v_updated_ids uuid[] := '{}';
    v_error_details jsonb := '[]'::jsonb;
    v_record_index integer := 0;
    record_data jsonb;
    existing_record_id uuid;
    chain_id_val uuid;
    project_id_val uuid;
    driver_id_val uuid;
    auto_number_val text;
    inserted_record_id uuid;
    update_result record;
    effective_billing_type_id bigint;
    v_other_platform_names text[];
    v_external_tracking_numbers text[];
BEGIN
    -- 处理每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        BEGIN
            -- 1. 获取项目ID
            SELECT id INTO project_id_val
            FROM public.projects 
            WHERE name = TRIM(record_data->>'project_name')
            LIMIT 1;

            IF project_id_val IS NULL THEN
                RAISE EXCEPTION '项目不存在: %', record_data->>'project_name';
            END IF;

            -- 2. 处理链路和计费类型
            chain_id_val := NULL;
            effective_billing_type_id := 1; -- 默认值

            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                -- 先查找指定链路
                SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                FROM public.partner_chains 
                WHERE chain_name = TRIM(record_data->>'chain_name')
                AND project_id = project_id_val
                LIMIT 1;

                -- 如果找不到，使用默认链路
                IF chain_id_val IS NULL THEN
                    SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                    FROM public.partner_chains 
                    WHERE project_id = project_id_val AND is_default = true
                    LIMIT 1;
                    
                    -- 如果连默认链路都没有，报错
                    IF chain_id_val IS NULL THEN
                        RAISE EXCEPTION '项目 % 没有配置合作链路，请先创建链路', record_data->>'project_name';
                    END IF;
                END IF;
            ELSE
                -- 如果没有指定链路名称，使用默认链路
                SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                FROM public.partner_chains 
                WHERE project_id = project_id_val AND is_default = true
                LIMIT 1;
                
                IF chain_id_val IS NULL THEN
                    RAISE EXCEPTION '项目 % 没有配置默认链路，请先创建链路', record_data->>'project_name';
                END IF;
            END IF;

            -- 3. 处理司机信息
            SELECT id INTO driver_id_val
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            LIMIT 1;

            IF driver_id_val IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, created_by_user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id INTO driver_id_val;
            END IF;

            -- 4. 处理 other_platform_names 字段（修正类型转换）
            v_other_platform_names := '{}'::text[];
            IF record_data->'other_platform_names' IS NOT NULL THEN
                -- 将 jsonb 数组转换为 text[] 数组
                SELECT array_agg(value::text) INTO v_other_platform_names
                FROM jsonb_array_elements_text(record_data->'other_platform_names')
                WHERE value::text != '';
                
                -- 如果转换后为空，设置为空数组
                IF v_other_platform_names IS NULL THEN
                    v_other_platform_names := '{}'::text[];
                END IF;
            END IF;

            -- 5. 处理 external_tracking_numbers 字段（存储为TEXT[]数组，每个元素可能包含|分隔的多个运单号）
            v_external_tracking_numbers := '{}'::text[];
            IF record_data->'external_tracking_numbers' IS NOT NULL THEN
                -- 将 jsonb 数组转换为 text[] 数组
                -- Excel格式：2021615278|2021615821
                -- 数据库格式：{"2021615278|2021615821"} (TEXT[]数组)
                SELECT array_agg(value::text) INTO v_external_tracking_numbers
                FROM jsonb_array_elements_text(record_data->'external_tracking_numbers')
                WHERE value::text != '';
                
                -- 如果转换后为空，设置为空数组
                IF v_external_tracking_numbers IS NULL THEN
                    v_external_tracking_numbers := '{}'::text[];
                END IF;
            END IF;

            -- 6. 检查是否存在重复记录
            SELECT id INTO existing_record_id
            FROM public.logistics_records
            WHERE project_name = TRIM(record_data->>'project_name')
            AND driver_name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            AND loading_location = TRIM(record_data->>'loading_location')
            AND unloading_location = TRIM(record_data->>'unloading_location')
            AND loading_date = (record_data->>'loading_date')::timestamptz
            AND loading_weight = (record_data->>'loading_weight')::numeric;

            IF existing_record_id IS NOT NULL AND p_update_mode THEN
                -- 更新模式：更新现有记录
                UPDATE public.logistics_records SET
                    project_id = project_id_val,
                    project_name = TRIM(record_data->>'project_name'),
                    chain_id = chain_id_val,
                    billing_type_id = effective_billing_type_id,
                    driver_id = driver_id_val,
                    driver_name = TRIM(record_data->>'driver_name'),
                    license_plate = TRIM(record_data->>'license_plate'),
                    driver_phone = TRIM(record_data->>'driver_phone'),
                    loading_location = TRIM(record_data->>'loading_location'),
                    unloading_location = TRIM(record_data->>'unloading_location'),
                    loading_date = (record_data->>'loading_date')::timestamptz,
                    unloading_date = CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                                         THEN (record_data->>'unloading_date')::timestamptz ELSE NULL END,
                    loading_weight = (record_data->>'loading_weight')::numeric,
                    unloading_weight = CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                                           THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    current_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                                       THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    extra_cost = CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                                     THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    payable_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                                       THEN (record_data->>'current_cost')::numeric ELSE 0 END +
                                  CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                                       THEN (record_data->>'extra_cost')::numeric ELSE 0 END, -- payable_cost = current_cost + extra_cost
                    transport_type = COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    remarks = TRIM(record_data->>'remarks'),
                    external_tracking_numbers = v_external_tracking_numbers,
                    other_platform_names = v_other_platform_names
                WHERE id = existing_record_id
                RETURNING id INTO update_result.id;

                v_updated_ids := v_updated_ids || existing_record_id;
                v_update_count := v_update_count + 1;

                -- 重新计算成本
                PERFORM public.recalculate_and_update_costs_for_record(existing_record_id);
            ELSE
                -- 创建模式：插入新记录
                auto_number_val := public.generate_auto_number(record_data->>'loading_date');

                INSERT INTO public.logistics_records (
                    auto_number, project_id, project_name, chain_id, billing_type_id,
                    driver_id, driver_name, loading_location, unloading_location,
                    loading_date, unloading_date, loading_weight, unloading_weight,
                    current_cost, extra_cost, payable_cost, license_plate, driver_phone,
                    transport_type, remarks, created_by_user_id, user_id,
                    external_tracking_numbers, other_platform_names
                ) VALUES (
                    auto_number_val, project_id_val, TRIM(record_data->>'project_name'),
                    chain_id_val, effective_billing_type_id,
                    driver_id_val, TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'loading_location'), TRIM(record_data->>'unloading_location'),
                    (record_data->>'loading_date')::timestamptz,
                    CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                         THEN (record_data->>'unloading_date')::timestamptz ELSE NULL END,
                    (record_data->>'loading_weight')::numeric,
                    CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                         THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                         THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                         THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                         THEN (record_data->>'current_cost')::numeric ELSE 0 END +
                    CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                         THEN (record_data->>'extra_cost')::numeric ELSE 0 END, -- payable_cost = current_cost + extra_cost
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    TRIM(record_data->>'remarks'),
                    auth.uid(),
                    auth.uid(),
                    v_external_tracking_numbers,
                    v_other_platform_names
                )
                RETURNING id INTO inserted_record_id;

                v_inserted_ids := v_inserted_ids || inserted_record_id;
                v_insert_count := v_insert_count + 1;

                -- 重新计算成本
                PERFORM public.recalculate_and_update_costs_for_record(inserted_record_id);
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

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'insert_count', v_insert_count,
        'update_count', v_update_count,
        'inserted_ids', v_inserted_ids,
        'updated_ids', v_updated_ids,
        'error_details', v_error_details
    );
END;
$$;
