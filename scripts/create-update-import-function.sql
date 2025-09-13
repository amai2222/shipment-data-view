-- 创建支持更新模式的运单导入函数
-- 此函数支持根据运单号更新现有记录，而不是创建新记录

-- 1. 创建更新模式的预览函数
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

            -- 2. 检查是否存在重复记录（基于8个关键字段）
            SELECT 
                lr.id,
                lr.auto_number,
                CASE WHEN EXISTS (
                    SELECT 1 FROM public.logistics_records lr2
                    WHERE lr2.project_name = TRIM(record_data->>'project_name')
                    AND lr2.driver_name = TRIM(record_data->>'driver_name')
                    AND lr2.license_plate = TRIM(record_data->>'license_plate')
                    AND lr2.loading_location = TRIM(record_data->>'loading_location')
                    AND lr2.unloading_location = TRIM(record_data->>'unloading_location')
                    AND lr2.loading_date = (record_data->>'loading_date')::timestamptz
                    AND lr2.loading_weight = (record_data->>'loading_weight')::numeric
                    AND lr2.id != lr.id
                ) THEN true ELSE false END
            INTO existing_record_id, existing_auto_number, is_duplicate
            FROM public.logistics_records lr
            WHERE lr.project_name = TRIM(record_data->>'project_name')
            AND lr.driver_name = TRIM(record_data->>'driver_name')
            AND lr.license_plate = TRIM(record_data->>'license_plate')
            AND lr.loading_location = TRIM(record_data->>'loading_location')
            AND lr.unloading_location = TRIM(record_data->>'unloading_location')
            AND lr.loading_date = (record_data->>'loading_date')::timestamptz
            AND lr.loading_weight = (record_data->>'loading_weight')::numeric
            LIMIT 1;

            -- 3. 构建处理后的记录，包含所有字段
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
                'remarks', record_data->>'remarks',
                'external_tracking_numbers', record_data->'external_tracking_numbers',
                'other_platform_names', record_data->'other_platform_names'
            );

            -- 4. 分类记录
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

    -- 5. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'update_records', update_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 2. 创建更新模式的导入函数
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
    v_inserted_ids uuid[] := ARRAY[]::uuid[];
    v_updated_ids uuid[] := ARRAY[]::uuid[];
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_update_count integer := 0;
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

            -- 2. 获取或创建合作链路
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val
                FROM public.partner_chains 
                WHERE name = TRIM(record_data->>'chain_name')
                AND project_id = project_id_val
                LIMIT 1;

                IF chain_id_val IS NULL THEN
                    INSERT INTO public.partner_chains (name, project_id, user_id)
                    VALUES (TRIM(record_data->>'chain_name'), project_id_val, auth.uid())
                    RETURNING id INTO chain_id_val;
                END IF;
            END IF;

            -- 3. 获取或创建司机
            SELECT id INTO driver_id_val
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            LIMIT 1;

            IF driver_id_val IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id INTO driver_id_val;
            END IF;

            -- 4. 检查是否存在重复记录
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
                    transport_type = COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    remarks = TRIM(record_data->>'remarks'),
                    external_tracking_numbers = CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                                                     THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                    other_platform_names = CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                                               THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
                WHERE id = existing_record_id
                RETURNING id INTO update_result.id;

                v_updated_ids := v_updated_ids || existing_record_id;
                v_update_count := v_update_count + 1;

                -- 重新计算成本
                PERFORM public.recalculate_and_update_costs_for_record(existing_record_id);

            ELSE
                -- 创建模式：创建新记录
                auto_number_val := public.generate_auto_number(record_data->>'loading_date');

                INSERT INTO public.logistics_records (
                    auto_number, project_id, project_name, loading_date, loading_location, 
                    unloading_location, driver_id, driver_name, license_plate, driver_phone,
                    loading_weight, unloading_date, unloading_weight, transport_type,
                    current_cost, extra_cost, payable_cost, remarks, created_by_user_id,
                    chain_id, external_tracking_numbers, other_platform_names
                ) VALUES (
                    auto_number_val, project_id_val, TRIM(record_data->>'project_name'),
                    (record_data->>'loading_date')::timestamptz, TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), driver_id_val, TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
                    CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                         THEN (record_data->>'unloading_date')::timestamptz ELSE NULL END,
                    CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                         THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                         THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                         THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    0, -- payable_cost 将在后续计算
                    TRIM(record_data->>'remarks'),
                    auth.uid(),
                    chain_id_val,
                    CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                         THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                    CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                         THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
                )
                RETURNING id INTO inserted_record_id;

                v_inserted_ids := v_inserted_ids || inserted_record_id;

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
            RAISE NOTICE '处理记录失败: %', SQLERRM;
        END;
    END LOOP;

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'inserted_count', array_length(v_inserted_ids, 1),
        'updated_count', v_update_count,
        'inserted_ids', v_inserted_ids,
        'updated_ids', v_updated_ids,
        'error_details', v_error_details
    );
END;
$$;

-- 3. 为函数添加注释
COMMENT ON FUNCTION public.preview_import_with_update_mode(jsonb) IS '预览导入数据，支持更新模式分类';
COMMENT ON FUNCTION public.batch_import_logistics_records_with_update(jsonb, boolean) IS '批量导入运单记录，支持更新模式';

-- 4. 完成提示
SELECT '更新模式导入函数创建完成！' as message;
