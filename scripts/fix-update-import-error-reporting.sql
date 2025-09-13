-- 修复更新模式导入错误报告功能
-- 添加详细的错误信息返回

-- 1. 更新 batch_import_logistics_records_with_update 函数
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
                RAISE EXCEPTION '项目不存在: %', TRIM(record_data->>'project_name');
            END IF;

            -- 2. 获取或创建司机
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

            -- 3. 获取或创建地点
            PERFORM public.get_or_create_locations_from_string(
                TRIM(record_data->>'loading_location') || '|' || TRIM(record_data->>'unloading_location')
            );

            -- 4. 获取合作链路ID
            chain_id_val := NULL;
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val
                FROM public.partner_chains 
                WHERE project_id = project_id_val 
                AND chain_name = TRIM(record_data->>'chain_name')
                LIMIT 1;
            END IF;

            -- 5. 检查是否存在重复记录（仅用于更新模式）
            IF p_update_mode THEN
                SELECT 
                    lr.id,
                    lr.auto_number
                INTO existing_record_id, auto_number_val
                FROM public.logistics_records lr
                WHERE lr.project_name = TRIM(record_data->>'project_name')
                AND lr.driver_name = TRIM(record_data->>'driver_name')
                AND lr.license_plate = TRIM(record_data->>'license_plate')
                AND lr.loading_location = TRIM(record_data->>'loading_location')
                AND lr.unloading_location = TRIM(record_data->>'unloading_location')
                AND lr.loading_date = (record_data->>'loading_date')::timestamptz
                AND lr.loading_weight = (record_data->>'loading_weight')::numeric
                LIMIT 1;
            END IF;

            -- 6. 执行更新或插入
            IF p_update_mode AND existing_record_id IS NOT NULL THEN
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

-- 2. 添加函数注释
COMMENT ON FUNCTION public.batch_import_logistics_records_with_update(jsonb, boolean) IS '批量导入运单记录，支持更新模式，返回详细错误信息';

-- 3. 创建测试函数
CREATE OR REPLACE FUNCTION public.test_update_import_error_reporting()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    RAISE NOTICE '=== 测试更新模式导入错误报告功能 ===';
    
    -- 创建测试数据（包含错误数据）
    test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '不存在的项目',
            'driver_name', '测试司机1',
            'license_plate', '京A12345',
            'loading_location', '北京仓库',
            'unloading_location', '上海仓库',
            'loading_date', '2025-01-20T00:00:00Z',
            'loading_weight', '25.5',
            'current_cost', '1000',
            'extra_cost', '100'
        )
    );
    
    -- 测试更新模式导入
    result := public.batch_import_logistics_records_with_update(test_records, true);
    
    -- 显示结果
    RAISE NOTICE '导入结果:';
    RAISE NOTICE '  成功数量: %', result->>'success_count';
    RAISE NOTICE '  失败数量: %', result->>'error_count';
    RAISE NOTICE '  创建数量: %', result->>'inserted_count';
    RAISE NOTICE '  更新数量: %', result->>'updated_count';
    
    -- 显示错误详情
    IF (result->>'error_count')::integer > 0 THEN
        RAISE NOTICE '错误详情:';
        RAISE NOTICE '%', result->'error_details';
    END IF;
    
    RAISE NOTICE '=== 测试完成 ===';
END;
$$;

-- 4. 执行测试
SELECT public.test_update_import_error_reporting();

-- 5. 清理测试函数
DROP FUNCTION public.test_update_import_error_reporting();
