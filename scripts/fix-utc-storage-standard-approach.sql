-- 方案1：保持UTC存储，修复比较逻辑
-- 符合行业标准：存储UTC，显示本地时区，比较时统一时区

-- 1. 检查当前数据状态
SELECT '=== 当前数据状态检查 ===' as status_title;
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    CASE 
        WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN 'UTC时区（标准）'
        WHEN EXTRACT(timezone_hour FROM loading_date) = 8 THEN '中国时区（需要转换回UTC）'
        ELSE '其他时区'
    END as status
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 2. 如果有中国时区数据，先转换回UTC（保持数据一致性）
-- 注意：只有在数据是中国时区时才需要执行
UPDATE logistics_records 
SET 
    loading_date = loading_date AT TIME ZONE 'UTC',
    unloading_date = CASE 
        WHEN unloading_date IS NOT NULL 
        THEN unloading_date AT TIME ZONE 'UTC'
        ELSE NULL 
    END,
    updated_at = NOW()
WHERE EXTRACT(timezone_hour FROM loading_date) = 8;

-- 3. 修复验重函数：使用UTC比较逻辑
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
    loading_date_parsed timestamptz;
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

        -- 4. 日期处理 - 将中国时区的日期转换为UTC进行比较
        loading_date_formatted := TRIM(record_data->>'loading_date');
        BEGIN
            -- 将中国时区的日期字符串转换为UTC时间进行比较
            -- 例如：'2025-09-06' -> '2025-09-06 00:00:00+08:00' -> UTC时间
            loading_date_parsed := (loading_date_formatted || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC';
        EXCEPTION
            WHEN OTHERS THEN
                error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '日期格式错误: ' || loading_date_formatted);
                CONTINUE;
        END;

        -- 5. 检查重复数据（使用8个关键字段，统一使用UTC时间比较）
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            WHERE
                TRIM(lr.project_name) = TRIM(record_data->>'project_name')                    -- 1. 项目名称
                AND lr.chain_id = chain_id_val                                               -- 2. 合作链路ID
                AND TRIM(lr.driver_name) = TRIM(record_data->>'driver_name')                 -- 3. 司机姓名
                AND TRIM(lr.license_plate) = TRIM(record_data->>'license_plate')             -- 4. 车牌号
                AND TRIM(lr.loading_location) = TRIM(record_data->>'loading_location')       -- 5. 装货地点
                AND TRIM(lr.unloading_location) = TRIM(record_data->>'unloading_location')   -- 6. 卸货地点
                AND lr.loading_date::date = loading_date_parsed::date                        -- 7. 装货日期（都转换为UTC的date进行比较）
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

-- 4. 修复导入函数：使用UTC存储
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
    WITH
    parsed_data AS (
        SELECT
            (rec->>'project_name')::text AS project_name,
            (rec->>'driver_name')::text AS driver_name,
            (rec->>'license_plate')::text AS license_plate,
            (rec->>'driver_phone')::text AS driver_phone,
            (rec->>'loading_location')::text AS loading_location,
            (rec->>'unloading_location')::text AS unloading_location,
            -- 将中国时区的日期转换为UTC存储
            -- 例如：'2025-09-06' -> '2025-09-06 00:00:00+08:00' -> UTC时间
            ((rec->>'loading_date' || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC') AS loading_date,
            COALESCE(
                NULLIF(rec->>'unloading_date', ''),
                rec->>'loading_date' || ' 00:00:00+08:00'
            )::timestamptz AT TIME ZONE 'UTC' AS unloading_date,
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
    projects_info AS (
        SELECT DISTINCT pd.project_name, p.id as project_id
        FROM parsed_data pd
        INNER JOIN public.projects p ON pd.project_name = p.name
    ),
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
    chains_info AS (
        SELECT DISTINCT 
            pd.chain_name,
            pi.project_id,
            COALESCE(pc.id, NULL) as chain_id
        FROM parsed_data pd
        CROSS JOIN projects_info pi
        LEFT JOIN public.partner_chains pc ON pd.chain_name = pc.chain_name AND pi.project_id = pc.project_id
    ),
    daily_max_sequence AS (
        SELECT 
            pd.loading_date::date as loading_date,
            COALESCE(MAX(CAST(SUBSTRING(lr.auto_number FROM 'YDN\d{8}-(\d{3})$') AS INTEGER)), 0) as max_sequence
        FROM parsed_data pd
        LEFT JOIN public.logistics_records lr ON pd.loading_date::date = lr.loading_date::date
            AND lr.auto_number LIKE 'YDN%'
        GROUP BY pd.loading_date::date
    ),
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
            pd.loading_date,        -- 已经是UTC时间
            pd.unloading_date,      -- 已经是UTC时间
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

    IF array_length(v_inserted_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
    END IF;

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

-- 5. 添加函数注释
COMMENT ON FUNCTION public.preview_import_with_duplicates_check(jsonb) IS 
'验重函数（标准UTC方案）
- 数据库存储UTC时间
- 验重时将中国时区日期转换为UTC进行比较
- 符合行业标准做法';

COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS 
'批量导入运单记录函数（标准UTC方案）
- 将中国时区日期转换为UTC存储
- 与验重函数使用相同的时区处理逻辑
- 符合行业标准做法';

-- 6. 验证修复结果
SELECT '=== 修复后验证 ===' as status_title;
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    CASE 
        WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN '✓ UTC时区（标准）'
        WHEN EXTRACT(timezone_hour FROM loading_date) = 8 THEN '中国时区'
        ELSE '其他时区'
    END as status
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 7. 测试验重函数
SELECT '=== 测试验重函数 ===' as status_title;
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "云南郝文学车队",
            "chain_name": "",
            "driver_name": "李永峰",
            "license_plate": "云G04011D",
            "driver_phone": "13988082141",
            "loading_location": "铜厂",
            "unloading_location": "火车站",
            "loading_date": "2025-09-05",
            "unloading_date": "2025-09-05",
            "loading_weight": "1",
            "unloading_weight": "1",
            "current_cost": "0",
            "extra_cost": "0",
            "transport_type": "实际运输",
            "remarks": "测试UTC方案"
        }
    ]'::jsonb
) as test_result;
