-- 多装多卸功能相关的新函数（便于回滚）
-- 所有函数都使用 _v2 后缀，避免与原有函数冲突

-- 0. 先删除可能存在的函数（避免参数名冲突）
DROP FUNCTION IF EXISTS public.compare_location_arrays_v2(text, text);
DROP FUNCTION IF EXISTS public.parse_location_string_v2(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_from_string_v2(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_batch_v2(text[]);
DROP FUNCTION IF EXISTS public.preview_import_with_duplicates_check_v2(jsonb);
DROP FUNCTION IF EXISTS public.check_logistics_record_duplicate_v2(text, text, text, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.add_logistics_record_with_costs_v2(uuid, uuid, uuid, text, text, text, text, text, text, text, numeric, text, numeric, numeric, uuid);
DROP FUNCTION IF EXISTS public.import_logistics_data_v2(jsonb);

-- 1. 创建地点数组比较函数（新版本）
CREATE OR REPLACE FUNCTION public.compare_location_arrays_v2(locations1 text, locations2 text)
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

-- 2. 创建地点字符串解析函数（新版本）
CREATE OR REPLACE FUNCTION public.parse_location_string_v2(location_string text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
DECLARE
    result text[];
    parts text[];
    part text;
BEGIN
    -- 处理空值
    IF location_string IS NULL OR location_string = '' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- 分割字符串
    parts := string_to_array(location_string, '|');
    result := ARRAY[]::text[];
    
    -- 处理每个部分
    FOREACH part IN ARRAY parts LOOP
        part := trim(part);
        IF part != '' THEN
            result := result || part;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;

-- 3. 创建地点获取或创建函数（新版本）
CREATE OR REPLACE FUNCTION public.get_or_create_locations_from_string_v2(p_location_string text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    location_names text[];
    location_ids text[] := ARRAY[]::text[];
    location_name text;
    location_id text;
    existing_location record;
BEGIN
    -- 解析地点字符串
    location_names := public.parse_location_string_v2(p_location_string);
    
    -- 处理每个地点
    FOREACH location_name IN ARRAY location_names LOOP
        -- 查找现有地点
        SELECT id INTO existing_location
        FROM public.locations 
        WHERE name = location_name;
        
        IF existing_location IS NOT NULL THEN
            -- 地点已存在，使用现有ID
            location_id := existing_location.id::text;
        ELSE
            -- 地点不存在，创建新地点
            INSERT INTO public.locations (name, created_at, updated_at)
            VALUES (location_name, NOW(), NOW())
            RETURNING id::text INTO location_id;
        END IF;
        
        -- 添加到结果数组
        location_ids := location_ids || location_id;
    END LOOP;
    
    RETURN location_ids;
END;
$$;

-- 4. 创建批量地点获取或创建函数（新版本）
CREATE OR REPLACE FUNCTION public.get_or_create_locations_batch_v2(p_location_strings text[])
RETURNS text[][]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result text[][] := ARRAY[]::text[][];
    location_string text;
    location_ids text[];
BEGIN
    -- 处理每个地点字符串
    FOREACH location_string IN ARRAY p_location_strings LOOP
        location_ids := public.get_or_create_locations_from_string_v2(location_string);
        result := result || location_ids;
    END LOOP;
    
    RETURN result;
END;
$$;

-- 5. 创建验重预览函数（新版本）
CREATE OR REPLACE FUNCTION public.preview_import_with_duplicates_check_v2(p_records jsonb)
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
            AND public.compare_location_arrays_v2(lr.loading_location, record_data->>'loading_location')
            AND public.compare_location_arrays_v2(lr.unloading_location, record_data->>'unloading_location')
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

-- 6. 创建单个记录验重函数（新版本）
CREATE OR REPLACE FUNCTION public.check_logistics_record_duplicate_v2(
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
        AND public.compare_location_arrays_v2(lr.loading_location, p_loading_location)
        AND public.compare_location_arrays_v2(lr.unloading_location, p_unloading_location)
        AND lr.loading_date::date = p_loading_date::date
        AND COALESCE(lr.loading_weight, 0) = COALESCE(p_loading_weight, 0)
    ) INTO is_duplicate;
    
    RETURN is_duplicate;
END;
$$;

-- 7. 创建添加运单记录函数（新版本）
CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs_v2(
    p_project_id uuid,
    p_chain_id uuid,
    p_driver_id uuid,
    p_project_name text,
    p_chain_name text,
    p_driver_name text,
    p_license_plate text,
    p_driver_phone text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date text,
    p_loading_weight numeric,
    p_transport_type text,
    p_loading_cost numeric,
    p_unloading_cost numeric,
    p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_record_id uuid;
    loading_location_ids text[];
    unloading_location_ids text[];
BEGIN
    -- 获取或创建地点ID
    loading_location_ids := public.get_or_create_locations_from_string_v2(p_loading_location);
    unloading_location_ids := public.get_or_create_locations_from_string_v2(p_unloading_location);
    
    -- 插入运单记录
    INSERT INTO public.logistics_records (
        auto_number, project_id, chain_id, driver_id, project_name, driver_name,
        license_plate, driver_phone, loading_location, unloading_location, loading_location_ids,
        unloading_location_ids, loading_date, loading_weight, transport_type,
        loading_cost, unloading_cost, user_id, created_by_user_id, created_at
    ) VALUES (
        public.generate_auto_number(p_loading_date), p_project_id, p_chain_id, p_driver_id, p_project_name, p_driver_name,
        p_license_plate, p_driver_phone, p_loading_location, p_unloading_location, loading_location_ids,
        unloading_location_ids, p_loading_date::date, p_loading_weight, p_transport_type,
        p_loading_cost, p_unloading_cost, p_user_id, p_user_id, NOW()
    ) RETURNING id INTO new_record_id;
    
    -- 重新计算成本
    PERFORM public.recalculate_and_update_costs_for_records(ARRAY[new_record_id]);
    
    RETURN new_record_id;
END;
$$;

-- 8. 创建批量导入函数（新版本）
CREATE OR REPLACE FUNCTION public.import_logistics_data_v2(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    project_id uuid;
    chain_id uuid;
    driver_id uuid;
    new_record_id uuid;
    success_count integer := 0;
    error_count integer := 0;
    error_messages text[] := ARRAY[]::text[];
    error_message text;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        BEGIN
            -- 获取项目ID
            SELECT id INTO project_id FROM public.projects WHERE name = (record_data->>'project_name');
            IF project_id IS NULL THEN
                error_count := error_count + 1;
                error_messages := error_messages || ('项目不存在: ' || (record_data->>'project_name'));
                CONTINUE;
            END IF;
            
            -- 获取链路ID
            SELECT id INTO chain_id FROM public.partner_chains 
            WHERE project_id = project_id AND chain_name = (record_data->>'chain_name');
            IF chain_id IS NULL THEN
                error_count := error_count + 1;
                error_messages := error_messages || ('链路不存在: ' || (record_data->>'chain_name'));
                CONTINUE;
            END IF;
            
            -- 获取或创建司机ID
            SELECT id INTO driver_id FROM public.drivers 
            WHERE name = (record_data->>'driver_name') AND license_plate = (record_data->>'license_plate');
            IF driver_id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    record_data->>'driver_name',
                    record_data->>'license_plate',
                    COALESCE(record_data->>'driver_phone', ''),
                    (SELECT auth.uid())
                ) RETURNING id INTO driver_id;
            END IF;
            
            -- 添加运单记录
            new_record_id := public.add_logistics_record_with_costs_v2(
                project_id, chain_id, driver_id,
                record_data->>'project_name',
                record_data->>'chain_name',
                record_data->>'driver_name',
                record_data->>'license_plate',
                record_data->>'loading_location',
                record_data->>'unloading_location',
                record_data->>'loading_date',
                (record_data->>'loading_weight')::numeric,
                COALESCE(record_data->>'transport_type', '实际运输'),
                COALESCE((record_data->>'loading_cost')::numeric, 0),
                COALESCE((record_data->>'unloading_cost')::numeric, 0),
                (SELECT auth.uid())
            );
            
            success_count := success_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            error_message := '记录处理失败: ' || SQLERRM;
            error_messages := error_messages || error_message;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success_count', success_count,
        'error_count', error_count,
        'error_messages', error_messages
    );
END;
$$;
