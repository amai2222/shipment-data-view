-- 修复验重函数中的日期处理问题
-- 解决Excel日期格式与数据库时区日期格式不匹配的问题

-- 1. 更新 preview_import_with_duplicates_check 函数，修复日期处理
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
    loading_date_parsed date;
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

        -- 4. 灵活处理日期格式
        loading_date_formatted := TRIM(record_data->>'loading_date');
        BEGIN
            -- 尝试多种日期格式解析
            IF loading_date_formatted ~ '^\d{4}-\d{2}-\d{2}$' THEN
                -- 格式: 2025-01-21
                loading_date_parsed := loading_date_formatted::date;
            ELSIF loading_date_formatted ~ '^\d{4}-\d{2}-\d{2}T' THEN
                -- 格式: 2025-01-21T00:00:00 或 2025-01-21T00:00:00+08:00
                loading_date_parsed := loading_date_formatted::timestamp::date;
            ELSIF loading_date_formatted ~ '^\d{4}/\d{2}/\d{2}$' THEN
                -- 格式: 2025/01/21
                loading_date_parsed := loading_date_formatted::date;
            ELSIF loading_date_formatted ~ '^\d{2}/\d{2}/\d{4}$' THEN
                -- 格式: 01/21/2025
                loading_date_parsed := to_date(loading_date_formatted, 'MM/DD/YYYY');
            ELSE
                -- 尝试通用日期解析
                loading_date_parsed := loading_date_formatted::date;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '日期格式错误: ' || loading_date_formatted);
                CONTINUE;
        END;

        -- 5. 检查重复数据（使用8个关键字段，正确处理日期）
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            WHERE
                TRIM(lr.project_name) = TRIM(record_data->>'project_name')                    -- 1. 项目名称
                AND lr.chain_id = chain_id_val                                               -- 2. 合作链路ID
                AND TRIM(lr.driver_name) = TRIM(record_data->>'driver_name')                 -- 3. 司机姓名
                AND TRIM(lr.license_plate) = TRIM(record_data->>'license_plate')             -- 4. 车牌号
                AND TRIM(lr.loading_location) = TRIM(record_data->>'loading_location')       -- 5. 装货地点
                AND TRIM(lr.unloading_location) = TRIM(record_data->>'unloading_location')   -- 6. 卸货地点
                AND DATE(lr.loading_date) = loading_date_parsed                              -- 7. 装货日期（使用DATE函数确保只比较日期部分）
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

-- 2. 更新 check_logistics_record_duplicate 函数，修复日期处理
CREATE OR REPLACE FUNCTION public.check_logistics_record_duplicate(
  p_project_name text,
  p_chain_id uuid,
  p_driver_name text,
  p_license_plate text,
  p_loading_location text,
  p_unloading_location text,
  p_loading_date date,
  p_loading_weight numeric,
  p_exclude_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.logistics_records
    WHERE TRIM(project_name) = TRIM(p_project_name)                    -- 1. 项目名称
    AND chain_id = p_chain_id                                         -- 2. 合作链路ID
    AND TRIM(driver_name) = TRIM(p_driver_name)                       -- 3. 司机姓名
    AND TRIM(license_plate) = TRIM(p_license_plate)                   -- 4. 车牌号
    AND TRIM(loading_location) = TRIM(p_loading_location)             -- 5. 装货地点
    AND TRIM(unloading_location) = TRIM(p_unloading_location)         -- 6. 卸货地点
    AND DATE(loading_date) = p_loading_date                           -- 7. 装货日期（使用DATE函数确保只比较日期部分）
    AND loading_weight = p_loading_weight                             -- 8. 装货数量
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
END;
$$;

-- 3. 添加函数注释
COMMENT ON FUNCTION public.preview_import_with_duplicates_check(jsonb) IS 
'验重逻辑：使用8个关键字段判断重复数据（已修复日期处理问题）
1. 项目名称 (project_name)
2. 合作链路 (chain_id，根据Excel中的文本名称找到partner_chains表中的对应ID)
3. 司机姓名 (driver_name)
4. 车牌号 (license_plate)
5. 装货地点 (loading_location)
6. 卸货地点 (unloading_location)
7. 装货日期 (loading_date) - 支持多种日期格式，使用DATE函数确保只比较日期部分
8. 装货数量 (loading_weight)
这些字段都为必填，使用TRIM去除空格进行精确匹配
支持的日期格式：
- 2025-01-21
- 2025-01-21T00:00:00
- 2025-01-21T00:00:00+08:00
- 2025/01/21
- 01/21/2025';

COMMENT ON FUNCTION public.check_logistics_record_duplicate(text, uuid, text, text, text, text, date, numeric, uuid) IS 
'验重逻辑：使用8个关键字段判断重复数据（已修复日期处理问题）
1. 项目名称 (project_name)
2. 合作链路 (chain_id)
3. 司机姓名 (driver_name)
4. 车牌号 (license_plate)
5. 装货地点 (loading_location)
6. 卸货地点 (unloading_location)
7. 装货日期 (loading_date) - 使用DATE函数确保只比较日期部分
8. 装货数量 (loading_weight)
使用TRIM去除空格进行精确匹配';
