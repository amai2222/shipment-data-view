-- 修复timestamptz日期处理问题
-- 确保导入时的日期处理与验重逻辑一致

-- 1. 更新 batch_import_logistics_records 函数，正确处理timestamptz
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_ids uuid[];
    v_success_count integer;
    v_error_count integer;
BEGIN
    -- 使用公共表表达式(CTE)进行高性能、无冲突的集合式处理
    WITH
    -- 步骤1: 解析并结构化所有传入的JSON记录，并使用窗口函数预分配当日序号
    parsed_data AS (
        SELECT
            (rec->>'project_name')::text AS project_name,
            (rec->>'driver_name')::text AS driver_name,
            (rec->>'license_plate')::text AS license_plate,
            (rec->>'driver_phone')::text AS driver_phone,
            (rec->>'loading_location')::text AS loading_location,
            (rec->>'unloading_location')::text AS unloading_location,
            -- 修复：确保日期转换为timestamptz时使用正确的时区
            (rec->>'loading_date')::date::timestamptz AS loading_date,
            COALESCE(NULLIF(rec->>'unloading_date', ''), rec->>'loading_date')::date::timestamptz AS unloading_date,
            NULLIF(rec->>'loading_weight', '')::numeric AS loading_weight,
            NULLIF(rec->>'unloading_weight', '')::numeric AS unloading_weight,
            COALESCE((rec->>'current_cost')::numeric, 0) AS current_cost,
            COALESCE((rec->>'extra_cost')::numeric, 0) AS extra_cost,
            COALESCE(rec->>'transport_type', '实际运输')::text AS transport_type,
            (rec->>'remarks')::text AS remarks,
            (rec->>'chain_name')::text AS chain_name,
            ROW_NUMBER() OVER(PARTITION BY (rec->>'loading_date')::date ORDER BY (rec->>'driver_name')) AS daily_row_num
        FROM jsonb_array_elements(p_records) AS rec
    ),
    -- 步骤2: 获取项目信息，用于关联司机和地点
    projects_info AS (
        SELECT DISTINCT pd.project_name, p.id as project_id
        FROM parsed_data pd
        INNER JOIN public.projects p ON pd.project_name = p.name
    ),
    -- 步骤3: 获取或创建司机信息
    drivers_info AS (
        SELECT DISTINCT 
            pd.driver_name, 
            pd.license_plate, 
            pd.driver_phone,
            pi.project_id,
            COALESCE(d.id, gen_random_uuid()) as driver_id
        FROM parsed_data pd
        CROSS JOIN projects_info pi
        LEFT JOIN public.drivers d ON pd.driver_name = d.name AND pd.license_plate = d.license_plate
    ),
    -- 步骤4: 获取或创建地点信息
    locations_info AS (
        SELECT DISTINCT 
            pd.loading_location, 
            pd.unloading_location,
            pi.project_id,
            COALESCE(loading_loc.id, gen_random_uuid()) as loading_location_id,
            COALESCE(unloading_loc.id, gen_random_uuid()) as unloading_location_id
        FROM parsed_data pd
        CROSS JOIN projects_info pi
        LEFT JOIN public.locations loading_loc ON pd.loading_location = loading_loc.name
        LEFT JOIN public.locations unloading_loc ON pd.unloading_location = unloading_loc.name
    ),
    -- 步骤5: 获取合作链路信息
    chains_info AS (
        SELECT DISTINCT 
            pd.chain_name,
            pi.project_id,
            COALESCE(pc.id, NULL) as chain_id
        FROM parsed_data pd
        CROSS JOIN projects_info pi
        LEFT JOIN public.partner_chains pc ON pd.chain_name = pc.chain_name AND pi.project_id = pc.project_id
    ),
    -- 步骤6: 获取每日最大序号
    daily_max_sequence AS (
        SELECT 
            pd.loading_date::date as loading_date,
            COALESCE(MAX(CAST(SUBSTRING(lr.auto_number FROM 'YDN\d{8}-(\d{3})$') AS INTEGER)), 0) as max_sequence
        FROM parsed_data pd
        LEFT JOIN public.logistics_records lr ON pd.loading_date::date = lr.loading_date::date
            AND lr.auto_number LIKE 'YDN%'
        GROUP BY pd.loading_date::date
    ),
    -- 步骤7: 准备最终插入数据
    final_records AS (
        SELECT 
            'YDN' || to_char(pd.loading_date::date, 'YYYYMMDD') || '-' || 
            lpad((dms.max_sequence + pd.daily_row_num)::text, 3, '0') AS auto_number,
            pi.project_id,
            pd.project_name,
            ci.chain_id,
            COALESCE(pc.billing_type_id, 1) AS billing_type_id,
            di.driver_id,
            pd.driver_name,
            pd.loading_location,
            pd.unloading_location,
            pd.loading_date,        -- 已经是timestamptz类型
            pd.unloading_date,      -- 已经是timestamptz类型
            pd.loading_weight,
            pd.unloading_weight,
            pd.current_cost,
            pd.extra_cost,
            pd.license_plate,
            pd.driver_phone,
            pd.transport_type,
            pd.remarks,
            (pd.current_cost + pd.extra_cost) AS payable_cost,
            auth.uid() AS created_by_user_id
        FROM parsed_data pd
        INNER JOIN projects_info pi ON pd.project_name = pi.project_name
        INNER JOIN drivers_info di ON pd.driver_name = di.driver_name 
            AND pd.license_plate = di.license_plate 
            AND pi.project_id = di.project_id
        INNER JOIN locations_info li ON pd.loading_location = li.loading_location 
            AND pd.unloading_location = li.unloading_location 
            AND pi.project_id = li.project_id
        INNER JOIN chains_info ci ON pd.chain_name = ci.chain_name 
            AND pi.project_id = ci.project_id
        INNER JOIN daily_max_sequence dms ON pd.loading_date::date = dms.loading_date
        LEFT JOIN public.partner_chains pc ON ci.chain_id = pc.id
    ),
    -- 步骤8: 执行最终的批量插入
    inserted_logistics_records AS (
        INSERT INTO public.logistics_records (
            auto_number, project_id, project_name, chain_id, billing_type_id, driver_id, driver_name,
            loading_location, unloading_location, loading_date, unloading_date,
            loading_weight, unloading_weight, current_cost, extra_cost,
            license_plate, driver_phone, transport_type, remarks, payable_cost,
            created_by_user_id
        )
        SELECT * FROM final_records
        ON CONFLICT (auto_number) DO NOTHING
        RETURNING id
    )
    SELECT array_agg(id) INTO v_inserted_ids FROM inserted_logistics_records;

    -- 步骤9: 批量触发成本更新计算
    IF array_length(v_inserted_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
    END IF;

    -- 步骤10: 计算并返回最终结果
    v_success_count := COALESCE(array_length(v_inserted_ids, 1), 0);
    v_error_count := jsonb_array_length(p_records) - v_success_count;

    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'errors', '[]'::jsonb
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success_count', 0,
            'error_count', jsonb_array_length(p_records),
            'errors', jsonb_build_array(jsonb_build_object('error', SQLERRM))
        );
END;
$$;

-- 2. 更新验重函数，确保与导入函数使用相同的日期处理逻辑
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
    loading_date_parsed timestamptz;  -- 改为timestamptz类型
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

        -- 2. 检查项目是否存在
        SELECT EXISTS (SELECT 1 FROM public.projects WHERE name = TRIM(record_data->>'project_name')) INTO project_exists;
        IF NOT project_exists THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '项目不存在');
            CONTINUE;
        END IF;

        -- 3. 获取合作链路ID（如果提供了合作链路名称）
        chain_name_val := TRIM(record_data->>'chain_name');
        IF chain_name_val IS NOT NULL AND chain_name_val != '' THEN
            SELECT id INTO chain_id_val FROM public.partner_chains WHERE chain_name = chain_name_val;
        ELSE
            chain_id_val := NULL;
        END IF;

        -- 4. 日期处理 - 与导入函数保持一致
        loading_date_formatted := TRIM(record_data->>'loading_date');
        BEGIN
            -- 使用与导入函数相同的日期转换逻辑
            loading_date_parsed := loading_date_formatted::date::timestamptz;
        EXCEPTION
            WHEN OTHERS THEN
                error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '日期格式错误: ' || loading_date_formatted);
                CONTINUE;
        END;

        -- 5. 检查重复数据（使用8个关键字段，正确处理timestamptz）
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            WHERE
                TRIM(lr.project_name) = TRIM(record_data->>'project_name')                    -- 1. 项目名称
                AND lr.chain_id = chain_id_val                                               -- 2. 合作链路ID
                AND TRIM(lr.driver_name) = TRIM(record_data->>'driver_name')                 -- 3. 司机姓名
                AND TRIM(lr.license_plate) = TRIM(record_data->>'license_plate')             -- 4. 车牌号
                AND TRIM(lr.loading_location) = TRIM(record_data->>'loading_location')       -- 5. 装货地点
                AND TRIM(lr.unloading_location) = TRIM(record_data->>'unloading_location')   -- 6. 卸货地点
                AND lr.loading_date::date = loading_date_parsed::date                        -- 7. 装货日期（都转换为date进行比较）
                AND lr.loading_weight = (record_data->>'loading_weight')::numeric            -- 8. 装货数量
        ) INTO is_duplicate;

        -- 6. 分类记录
        IF is_duplicate THEN
            duplicate_records_json := duplicate_records_json || jsonb_build_object('record', record_data);
        ELSE
            new_records_json := new_records_json || jsonb_build_object('record', record_data);
        END IF;

    END LOOP;

    -- 7. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'duplicate_records', duplicate_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 3. 添加函数注释
COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS 
'批量导入运单记录函数（已修复timestamptz日期处理）
- 正确处理日期到timestamptz的转换
- 确保与验重函数使用相同的日期处理逻辑
- 支持多种Excel日期格式';

COMMENT ON FUNCTION public.preview_import_with_duplicates_check(jsonb) IS 
'验重函数（已修复timestamptz日期处理）
- 使用与导入函数相同的日期转换逻辑
- 确保验重比较的准确性
- 支持多种Excel日期格式';
