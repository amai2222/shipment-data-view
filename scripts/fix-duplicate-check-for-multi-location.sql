-- 修复多装多卸功能的验重逻辑
-- 更新现有函数支持多地点比较

-- 0. 先删除可能存在的函数（避免参数名冲突）
DROP FUNCTION IF EXISTS public.compare_location_arrays(text, text);
DROP FUNCTION IF EXISTS public.preview_import_with_duplicates_check(jsonb);
DROP FUNCTION IF EXISTS public.check_logistics_record_duplicate(text, text, text, text, text, text, text, numeric);

-- 1. 创建地点数组比较函数
CREATE OR REPLACE FUNCTION public.compare_location_arrays(locations1 text, locations2 text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    arr1 text[];
    arr2 text[];
    loc1 text;
    loc2 text;
    found boolean;
BEGIN
    -- 处理空值
    IF locations1 IS NULL OR locations1 = '' THEN
        locations1 := '';
    END IF;
    IF locations2 IS NULL OR locations2 = '' THEN
        locations2 := '';
    END IF;
    
    -- 如果两个都是空，认为相等
    IF locations1 = '' AND locations2 = '' THEN
        RETURN true;
    END IF;
    
    -- 分割字符串为数组
    arr1 := string_to_array(locations1, '|');
    arr2 := string_to_array(locations2, '|');
    
    -- 去除空白字符
    FOR i IN 1..array_length(arr1, 1) LOOP
        arr1[i] := trim(arr1[i]);
    END LOOP;
    FOR i IN 1..array_length(arr2, 1) LOOP
        arr2[i] := trim(arr2[i]);
    END LOOP;
    
    -- 过滤空字符串
    arr1 := array_remove(arr1, '');
    arr2 := array_remove(arr2, '');
    
    -- 如果数组长度不同，直接返回false
    IF array_length(arr1, 1) != array_length(arr2, 1) THEN
        RETURN false;
    END IF;
    
    -- 检查arr1中的每个元素是否都在arr2中
    FOREACH loc1 IN ARRAY arr1 LOOP
        found := false;
        FOREACH loc2 IN ARRAY arr2 LOOP
            IF loc1 = loc2 THEN
                found := true;
                EXIT;
            END IF;
        END LOOP;
        IF NOT found THEN
            RETURN false;
        END IF;
    END LOOP;
    
    RETURN true;
END;
$$;

-- 2. 更新验重预览函数
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
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        -- 1. 检查必填字段和项目是否存在
        IF (record_data->>'project_name') IS NULL OR (record_data->>'project_name') = '' OR
           (record_data->>'driver_name') IS NULL OR (record_data->>'driver_name') = '' OR
           (record_data->>'loading_location') IS NULL OR (record_data->>'loading_location') = '' OR
           (record_data->>'unloading_location') IS NULL OR (record_data->>'unloading_location') = '' OR
           (record_data->>'loading_date') IS NULL OR (record_data->>'loading_date') = '' THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '缺少必填字段');
            CONTINUE;
        END IF;

        SELECT EXISTS (SELECT 1 FROM public.projects WHERE name = (record_data->>'project_name')) INTO project_exists;
        IF NOT project_exists THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '项目不存在');
            CONTINUE;
        END IF;

        -- 2. 检查重复记录（使用多地点比较）
        chain_name_val := record_data->>'chain_name';
        loading_date_formatted := (record_data->>'loading_date');
        
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
            WHERE lr.project_name = (record_data->>'project_name')
            AND COALESCE(pc.chain_name, '') = COALESCE(chain_name_val, '')
            AND lr.driver_name = (record_data->>'driver_name')
            AND COALESCE(lr.license_plate, '') = COALESCE(record_data->>'license_plate', '')
            AND public.compare_location_arrays(lr.loading_location, record_data->>'loading_location')
            AND public.compare_location_arrays(lr.unloading_location, record_data->>'unloading_location')
            AND lr.loading_date::date = loading_date_formatted::date
            AND COALESCE(lr.loading_weight, 0) = COALESCE((record_data->>'loading_weight')::numeric, 0)
        ) INTO is_duplicate;

        -- 3. 分类记录
        IF is_duplicate THEN
            duplicate_records_json := duplicate_records_json || jsonb_build_object('record', record_data);
        ELSE
            new_records_json := new_records_json || jsonb_build_object('record', record_data);
        END IF;
    END LOOP;

    -- 4. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'duplicate_records', duplicate_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 3. 更新单个记录验重函数
CREATE OR REPLACE FUNCTION public.check_logistics_record_duplicate(
    p_project_name text,
    p_chain_name text,
    p_driver_name text,
    p_license_plate text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date text,
    p_loading_weight numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    is_duplicate boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE lr.project_name = p_project_name
        AND COALESCE(pc.chain_name, '') = COALESCE(p_chain_name, '')
        AND lr.driver_name = p_driver_name
        AND COALESCE(lr.license_plate, '') = COALESCE(p_license_plate, '')
        AND public.compare_location_arrays(lr.loading_location, p_loading_location)
        AND public.compare_location_arrays(lr.unloading_location, p_unloading_location)
        AND lr.loading_date::date = p_loading_date::date
        AND COALESCE(lr.loading_weight, 0) = COALESCE(p_loading_weight, 0)
    ) INTO is_duplicate;
    
    RETURN is_duplicate;
END;
$$;
