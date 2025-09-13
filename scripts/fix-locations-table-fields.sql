-- 修复locations表字段引用问题
-- 问题：多个函数中引用了不存在的 updated_at 字段

-- 1. 先检查locations表的实际结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 修复 get_or_create_locations_from_string 函数
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
            -- 地点不存在，创建新地点（只使用存在的字段）
            INSERT INTO public.locations (name, created_at)
            VALUES (location_name, NOW())
            RETURNING id::text INTO location_id;
        END IF;
        
        -- 添加到结果数组
        location_ids := location_ids || location_id;
    END LOOP;
    
    RETURN location_ids;
END;
$$;

-- 3. 修复 get_or_create_locations_from_string_v2 函数
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
            -- 地点不存在，创建新地点（只使用存在的字段）
            INSERT INTO public.locations (name, created_at)
            VALUES (location_name, NOW())
            RETURNING id::text INTO location_id;
        END IF;
        
        -- 添加到结果数组
        location_ids := location_ids || location_id;
    END LOOP;
    
    RETURN location_ids;
END;
$$;

-- 4. 测试修复后的函数
DO $$
DECLARE
    test_location_string text := '北京仓库|上海仓库|广州仓库';
    result text[];
BEGIN
    -- 测试get_or_create_locations_from_string函数
    SELECT public.get_or_create_locations_from_string(test_location_string) INTO result;
    
    IF result IS NOT NULL AND array_length(result, 1) > 0 THEN
        RAISE NOTICE '✅ 地点解析函数正常工作';
        RAISE NOTICE '解析结果: %', result;
    ELSE
        RAISE NOTICE '❌ 地点解析函数返回空结果';
    END IF;
END $$;

-- 5. 验证修复结果
SELECT 
    COUNT(*) as total_locations,
    COUNT(CASE WHEN name LIKE '%仓库%' THEN 1 END) as warehouse_locations,
    COUNT(CASE WHEN name LIKE '%北京%' THEN 1 END) as beijing_locations,
    COUNT(CASE WHEN name LIKE '%上海%' THEN 1 END) as shanghai_locations
FROM locations;
