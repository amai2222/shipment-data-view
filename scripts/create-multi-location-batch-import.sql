-- 多地点自动创建功能脚本
-- 支持在导入时自动创建不存在的地址

-- 0. 先删除可能存在的函数（避免参数名冲突）
DROP FUNCTION IF EXISTS public.parse_location_string(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_from_string(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_batch(text[]);
DROP FUNCTION IF EXISTS public.batch_import_logistics_records(jsonb);

-- 1. 创建地点字符串解析函数
CREATE OR REPLACE FUNCTION public.parse_location_string(location_string text)
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

-- 2. 创建地点获取或创建函数
CREATE OR REPLACE FUNCTION public.get_or_create_locations_from_string(p_location_string text)
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
    location_names := public.parse_location_string(p_location_string);
    
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

-- 3. 创建批量地点获取或创建函数
CREATE OR REPLACE FUNCTION public.get_or_create_locations_batch(p_location_strings text[])
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
        location_ids := public.get_or_create_locations_from_string(location_string);
        result := result || location_ids;
    END LOOP;
    
    RETURN result;
END;
$$;

-- 4. 更新批量导入函数支持多地点自动创建
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
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
    loading_location_ids text[];
    unloading_location_ids text[];
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
            
            -- 获取或创建地点ID
            loading_location_ids := public.get_or_create_locations_from_string(record_data->>'loading_location');
            unloading_location_ids := public.get_or_create_locations_from_string(record_data->>'unloading_location');
            
            -- 插入运单记录
            INSERT INTO public.logistics_records (
                auto_number, project_id, chain_id, driver_id, project_name, driver_name,
                license_plate, driver_phone, loading_location, unloading_location, loading_location_ids,
                unloading_location_ids, loading_date, loading_weight, transport_type,
                loading_cost, unloading_cost, user_id, created_by_user_id, created_at
            ) VALUES (
                public.generate_auto_number(record_data->>'loading_date'), project_id, chain_id, driver_id,
                record_data->>'project_name',
                record_data->>'driver_name',
                record_data->>'license_plate',
                COALESCE(record_data->>'driver_phone', ''),
                record_data->>'loading_location',
                record_data->>'unloading_location',
                loading_location_ids,
                unloading_location_ids,
                (record_data->>'loading_date')::date,
                (record_data->>'loading_weight')::numeric,
                COALESCE(record_data->>'transport_type', '实际运输'),
                COALESCE((record_data->>'loading_cost')::numeric, 0),
                COALESCE((record_data->>'unloading_cost')::numeric, 0),
                (SELECT auth.uid()),
                (SELECT auth.uid()),
                NOW()
            ) RETURNING id INTO new_record_id;
            
            -- 重新计算成本
            PERFORM public.recalculate_and_update_costs_for_records(ARRAY[new_record_id]);
            
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
