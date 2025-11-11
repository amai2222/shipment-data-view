-- 创建支持更新模式的批量导入函数
-- 此迁移创建 batch_import_logistics_records_with_update 和 preview_import_with_update_mode 函数
-- 这些函数支持导入时选择"更新现有记录"或"创建新记录"

-- 1. 创建预览函数（支持更新模式）
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

            -- 4. 日期处理
            loading_date_formatted := TRIM(record_data->>'loading_date');

            -- 5. 检查是否存在重复记录（基于8个关键字段）
            SELECT 
                lr.id,
                lr.auto_number
            INTO existing_record_id, existing_auto_number
            FROM public.logistics_records lr
            WHERE lr.project_name = TRIM(record_data->>'project_name')
            AND (lr.chain_id = chain_id_val OR (lr.chain_id IS NULL AND chain_id_val IS NULL))
            AND lr.driver_name = TRIM(record_data->>'driver_name')
            AND lr.license_plate = TRIM(record_data->>'license_plate')
            AND lr.loading_location = TRIM(record_data->>'loading_location')
            AND lr.unloading_location = TRIM(record_data->>'unloading_location')
            AND lr.loading_date::date = loading_date_formatted::date
            AND lr.loading_weight = (record_data->>'loading_weight')::numeric
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

-- 2. 创建批量导入函数（支持更新模式）
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
    v_insert_count integer := 0;
    v_update_count integer := 0;
    v_error_details jsonb := '[]'::jsonb;
    v_record_index integer := 0;
    record_data jsonb;
    processed_record jsonb;
    existing_record_id uuid;
    chain_id_val uuid;
    project_id_val uuid;
    driver_id_val uuid;
    auto_number_val text;
    inserted_record_id uuid;
    v_external_tracking_numbers text[];
    v_other_platform_names text[];
    v_loading_date_formatted text;
    v_unloading_date_formatted text;
BEGIN
    -- 处理每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        BEGIN
            -- 日期处理
            v_loading_date_formatted := TRIM(record_data->>'loading_date');
            v_unloading_date_formatted := COALESCE(NULLIF(TRIM(record_data->>'unloading_date'), ''), v_loading_date_formatted);
            
            -- 处理外部跟踪号和平台名称数组
            IF record_data->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(record_data->'external_tracking_numbers') > 0 THEN
                SELECT array_agg(value::text) INTO v_external_tracking_numbers
                FROM jsonb_array_elements_text(record_data->'external_tracking_numbers')
                WHERE value::text != '';
                IF v_external_tracking_numbers IS NULL THEN
                    v_external_tracking_numbers := '{}'::text[];
                END IF;
            ELSE
                v_external_tracking_numbers := '{}'::text[];
            END IF;
            
            IF record_data->'other_platform_names' IS NOT NULL AND jsonb_array_length(record_data->'other_platform_names') > 0 THEN
                SELECT array_agg(value::text) INTO v_other_platform_names
                FROM jsonb_array_elements_text(record_data->'other_platform_names')
                WHERE value::text != '';
                IF v_other_platform_names IS NULL THEN
                    v_other_platform_names := '{}'::text[];
                END IF;
            ELSE
                v_other_platform_names := '{}'::text[];
            END IF;
            
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
                WHERE chain_name = TRIM(record_data->>'chain_name')
                AND project_id = project_id_val
                LIMIT 1;
            ELSE
                chain_id_val := NULL;
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
                
                -- 关联司机到项目
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (driver_id_val, project_id_val, auth.uid())
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END IF;
            
            -- 关联地点到项目
            INSERT INTO public.locations (name, user_id)
            VALUES (TRIM(record_data->>'loading_location'), auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            INSERT INTO public.locations (name, user_id)
            VALUES (TRIM(record_data->>'unloading_location'), auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            SELECT l.id, project_id_val, auth.uid()
            FROM public.locations l
            WHERE l.name IN (
                TRIM(record_data->>'loading_location'),
                TRIM(record_data->>'unloading_location')
            )
            ON CONFLICT (location_id, project_id) DO NOTHING;

            -- 4. 检查是否存在重复记录（基于8个关键字段）
            SELECT id INTO existing_record_id
            FROM public.logistics_records
            WHERE project_name = TRIM(record_data->>'project_name')
            AND (chain_id = chain_id_val OR (chain_id IS NULL AND chain_id_val IS NULL))
            AND driver_name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            AND loading_location = TRIM(record_data->>'loading_location')
            AND unloading_location = TRIM(record_data->>'unloading_location')
            AND loading_date::date = v_loading_date_formatted::date
            AND loading_weight = (record_data->>'loading_weight')::numeric
            LIMIT 1;

            IF existing_record_id IS NOT NULL AND p_update_mode THEN
                -- 更新模式：更新现有记录
                UPDATE public.logistics_records SET
                    project_id = project_id_val,
                    chain_id = chain_id_val,
                    driver_id = driver_id_val,
                    driver_phone = TRIM(record_data->>'driver_phone'),
                    unloading_date = CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                                         THEN (v_unloading_date_formatted || ' 00:00:00+08:00')::timestamptz ELSE NULL END,
                    unloading_weight = CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                                           THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    current_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                                       THEN (record_data->>'current_cost')::numeric ELSE current_cost END,
                    extra_cost = CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                                     THEN (record_data->>'extra_cost')::numeric ELSE extra_cost END,
                    transport_type = CASE WHEN record_data->>'transport_type' IS NOT NULL AND TRIM(record_data->>'transport_type') != ''
                                         THEN COALESCE(TRIM(record_data->>'transport_type'), '实际运输') ELSE transport_type END,
                    cargo_type = CASE WHEN record_data->>'cargo_type' IS NOT NULL AND TRIM(record_data->>'cargo_type') != ''
                                     THEN TRIM(record_data->>'cargo_type') ELSE cargo_type END,
                    remarks = CASE WHEN record_data->>'remarks' IS NOT NULL AND TRIM(record_data->>'remarks') != ''
                                  THEN TRIM(record_data->>'remarks') ELSE remarks END,
                    external_tracking_numbers = CASE WHEN array_length(v_external_tracking_numbers, 1) > 0
                                                     THEN v_external_tracking_numbers ELSE external_tracking_numbers END,
                    other_platform_names = CASE WHEN array_length(v_other_platform_names, 1) > 0
                                               THEN v_other_platform_names ELSE other_platform_names END,
                    updated_at = NOW()
                WHERE id = existing_record_id;

                v_updated_ids := array_append(v_updated_ids, existing_record_id);
                v_update_count := v_update_count + 1;

            ELSIF existing_record_id IS NULL THEN
                -- 创建模式：创建新记录
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
                    (v_loading_date_formatted || ' 00:00:00+08:00')::timestamptz,
                    TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), 
                    driver_id_val, 
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), 
                    TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
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

-- 3. 添加函数注释
COMMENT ON FUNCTION public.preview_import_with_update_mode(jsonb) IS '预览导入数据，支持更新模式分类，返回新记录和重复记录';
COMMENT ON FUNCTION public.batch_import_logistics_records_with_update(jsonb, boolean) IS '批量导入运单记录，支持更新模式（p_update_mode=true时更新重复记录，false时跳过）';

-- 完成提示
SELECT '更新模式导入函数创建完成！' as message;

