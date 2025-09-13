-- 修复导入功能中的平台字段处理问题
-- 问题：preview_import_with_duplicates_check 函数没有处理 external_tracking_numbers 和 other_platform_names 字段

-- 1. 更新 preview_import_with_duplicates_check 函数，支持平台字段
CREATE OR REPLACE FUNCTION public.preview_import_with_duplicates_check(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    new_records_json jsonb := '[]'::jsonb;
    duplicate_records_json jsonb := '[]'::jsonb;
    error_records_json jsonb := '[]'::jsonb;
    project_exists boolean;
    is_duplicate boolean;
    chain_name_val text;
    loading_date_formatted text;
    chain_id_val uuid;
    project_id_val uuid;
    processed_record jsonb;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        -- 1. 检查必填字段（8个关键字段）
        IF (record_data->>'project_name') IS NULL OR TRIM(record_data->>'project_name') = '' OR
           (record_data->>'driver_name') IS NULL OR TRIM(record_data->>'driver_name') = '' OR
           (record_data->>'license_plate') IS NULL OR TRIM(record_data->>'license_plate') = '' OR
           (record_data->>'loading_location') IS NULL OR TRIM(record_data->>'loading_location') = '' OR
           (record_data->>'unloading_location') IS NULL OR TRIM(record_data->>'unloading_location') = '' OR
           (record_data->>'loading_date') IS NULL OR TRIM(record_data->>'loading_date') = '' OR
           (record_data->>'loading_weight') IS NULL OR TRIM(record_data->>'loading_weight') = '' THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '缺少必填字段（8个关键字段）');
            CONTINUE;
        END IF;

        -- 2. 检查项目是否存在并获取项目ID
        SELECT EXISTS (SELECT 1 FROM public.projects WHERE name = TRIM(record_data->>'project_name')), 
               (SELECT id FROM public.projects WHERE name = TRIM(record_data->>'project_name') LIMIT 1)
        INTO project_exists, project_id_val;
        
        IF NOT project_exists THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '项目不存在');
            CONTINUE;
        END IF;

        -- 3. 处理合作链路ID
        chain_name_val := TRIM(record_data->>'chain_name');
        IF chain_name_val IS NOT NULL AND chain_name_val != '' THEN
            SELECT id INTO chain_id_val 
            FROM public.partner_chains 
            WHERE chain_name = chain_name_val AND project_id = project_id_val
            LIMIT 1;
        ELSE
            chain_id_val := NULL;
        END IF;

        -- 4. 处理日期格式
        loading_date_formatted := TRIM(record_data->>'loading_date');
        
        -- 5. 检查重复记录（使用8个关键字段）
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
            WHERE lr.project_name = TRIM(record_data->>'project_name')
            AND COALESCE(pc.chain_name, '') = COALESCE(chain_name_val, '')
            AND lr.driver_name = TRIM(record_data->>'driver_name')
            AND COALESCE(lr.license_plate, '') = COALESCE(TRIM(record_data->>'license_plate'), '')
            AND COALESCE(lr.driver_phone, '') = COALESCE(TRIM(record_data->>'driver_phone'), '')
            AND lr.loading_location = TRIM(record_data->>'loading_location')
            AND lr.unloading_location = TRIM(record_data->>'unloading_location')
            AND lr.loading_date::date = loading_date_formatted::date
            AND COALESCE(lr.loading_weight, 0) = COALESCE((record_data->>'loading_weight')::numeric, 0)
        ) INTO is_duplicate;

        -- 6. 构建处理后的记录，包含所有字段（包括平台字段）
        processed_record := jsonb_build_object(
            'project_name', TRIM(record_data->>'project_name'),
            'chain_name', chain_name_val,
            'driver_name', TRIM(record_data->>'driver_name'),
            'license_plate', TRIM(record_data->>'license_plate'),
            'driver_phone', TRIM(record_data->>'driver_phone'),
            'loading_location', TRIM(record_data->>'loading_location'),
            'unloading_location', TRIM(record_data->>'unloading_location'),
            'loading_date', loading_date_formatted,
            'unloading_date', TRIM(record_data->>'unloading_date'),
            'loading_weight', record_data->>'loading_weight',
            'unloading_weight', record_data->>'unloading_weight',
            'current_cost', record_data->>'current_cost',
            'extra_cost', record_data->>'extra_cost',
            'transport_type', COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
            'remarks', TRIM(record_data->>'remarks'),
            -- 平台字段：确保这些字段被正确传递
            'external_tracking_numbers', record_data->'external_tracking_numbers',
            'other_platform_names', record_data->'other_platform_names'
        );

        -- 7. 分类记录
        IF is_duplicate THEN
            duplicate_records_json := duplicate_records_json || jsonb_build_object('record', processed_record);
        ELSE
            new_records_json := new_records_json || jsonb_build_object('record', processed_record);
        END IF;
    END LOOP;

    -- 8. 返回结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'duplicate_records', duplicate_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 2. 更新 batch_import_logistics_records 函数，确保支持平台字段
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    success_count integer := 0;
    error_count integer := 0;
    error_logs jsonb := '[]'::jsonb;
    project_id_val uuid;
    chain_id_val uuid;
    driver_id_val uuid;
    auto_number_val text;
    inserted_record_id uuid;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 获取项目ID
            SELECT id INTO project_id_val 
            FROM public.projects 
            WHERE name = TRIM(record_data->>'project_name') 
            LIMIT 1;

            -- 获取合作链路ID
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val 
                FROM public.partner_chains 
                WHERE chain_name = TRIM(record_data->>'chain_name') 
                AND project_id = project_id_val
                LIMIT 1;
            ELSE
                chain_id_val := NULL;
            END IF;

            -- 获取或创建司机
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

            -- 生成自动编号
            auto_number_val := public.generate_auto_number(record_data->>'loading_date');

            -- 插入运单记录，包含平台字段
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
                -- 平台字段：确保正确插入
                CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                     THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                     THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
            )
            RETURNING id INTO inserted_record_id;

            -- 重新计算费用
            PERFORM public.recalculate_and_update_costs_for_records(ARRAY[inserted_record_id]);

            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            error_logs := error_logs || jsonb_build_object(
                'record', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success_count', success_count,
        'error_count', error_count,
        'error_logs', error_logs
    );
END;
$$;

-- 3. 创建测试函数验证平台字段导入
CREATE OR REPLACE FUNCTION public.test_platform_fields_import()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    test_records jsonb;
    preview_result jsonb;
    import_result jsonb;
BEGIN
    -- 创建测试数据
    test_records := '[
        {
            "project_name": "测试项目",
            "driver_name": "测试司机",
            "license_plate": "测试车牌",
            "driver_phone": "13800138000",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "2025-01-20",
            "loading_weight": "25.5",
            "current_cost": "1500",
            "extra_cost": "100",
            "transport_type": "实际运输",
            "remarks": "测试备注",
            "external_tracking_numbers": [
                {
                    "platform": "货拉拉",
                    "tracking_number": "HL20250120001",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                }
            ],
            "other_platform_names": ["货拉拉", "满帮"]
        }
    ]'::jsonb;

    -- 测试预览功能
    SELECT public.preview_import_with_duplicates_check(test_records) INTO preview_result;
    
    -- 测试导入功能
    SELECT public.batch_import_logistics_records(test_records) INTO import_result;

    RETURN jsonb_build_object(
        'preview_result', preview_result,
        'import_result', import_result,
        'test_completed', true
    );
END;
$$;

-- 4. 添加注释说明
COMMENT ON FUNCTION public.preview_import_with_duplicates_check(jsonb) IS '预览导入并检查重复，支持平台字段 external_tracking_numbers 和 other_platform_names';
COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS '批量导入运单记录，支持平台字段 external_tracking_numbers 和 other_platform_names';
COMMENT ON FUNCTION public.test_platform_fields_import() IS '测试平台字段导入功能';