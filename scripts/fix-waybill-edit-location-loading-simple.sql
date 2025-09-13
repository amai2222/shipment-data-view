-- 修复运单编辑时卸货地点不能读取的问题（简化版）
-- 先检查locations表结构，然后进行相应的修复

-- 1. 检查locations表结构
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查logistics_records表中的地点数据格式
SELECT 
    auto_number,
    loading_location,
    unloading_location,
    LENGTH(loading_location) as loading_location_length,
    LENGTH(unloading_location) as unloading_location_length
FROM logistics_records 
WHERE loading_location IS NOT NULL 
   OR unloading_location IS NOT NULL
LIMIT 5;

-- 3. 检查地点表数据
SELECT 
    id,
    name,
    created_at
FROM locations 
ORDER BY created_at DESC
LIMIT 10;

-- 4. 检查地点字符串解析函数是否存在
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_locations_from_string'
AND routine_schema = 'public';

-- 5. 测试地点字符串解析
DO $$
DECLARE
    test_location_string text := '北京仓库|上海仓库|广州仓库';
    result jsonb;
BEGIN
    -- 测试get_or_create_locations_from_string函数
    SELECT public.get_or_create_locations_from_string(test_location_string) INTO result;
    
    IF result IS NOT NULL THEN
        RAISE NOTICE '✅ 地点解析函数正常工作';
        RAISE NOTICE '解析结果: %', result;
    ELSE
        RAISE NOTICE '❌ 地点解析函数返回空结果';
    END IF;
END $$;

-- 6. 检查是否有地点数据不一致的问题
-- 查找logistics_records中引用了不存在的地点
SELECT DISTINCT
    lr.auto_number,
    lr.loading_location,
    lr.unloading_location,
    CASE 
        WHEN l.name IS NULL THEN '地点不存在'
        ELSE '地点存在'
    END as loading_location_status,
    CASE 
        WHEN u.name IS NULL THEN '地点不存在'
        ELSE '地点存在'
    END as unloading_location_status
FROM logistics_records lr
LEFT JOIN locations l ON l.name = SPLIT_PART(lr.loading_location, '|', 1)
LEFT JOIN locations u ON u.name = SPLIT_PART(lr.unloading_location, '|', 1)
WHERE lr.loading_location IS NOT NULL 
   OR lr.unloading_location IS NOT NULL
LIMIT 10;

-- 7. 创建地点数据修复函数（根据实际表结构调整）
CREATE OR REPLACE FUNCTION public.fix_missing_locations()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    location_name text;
BEGIN
    -- 查找所有logistics_records中引用的地点名称
    FOR rec IN 
        SELECT DISTINCT 
            UNNEST(STRING_TO_ARRAY(loading_location, '|')) as location_name
        FROM logistics_records 
        WHERE loading_location IS NOT NULL
        
        UNION
        
        SELECT DISTINCT 
            UNNEST(STRING_TO_ARRAY(unloading_location, '|')) as location_name
        FROM logistics_records 
        WHERE unloading_location IS NOT NULL
    LOOP
        location_name := TRIM(rec.location_name);
        
        -- 检查地点是否存在
        IF NOT EXISTS (SELECT 1 FROM locations WHERE name = location_name) THEN
            -- 创建缺失的地点（根据实际表结构调整字段）
            INSERT INTO locations (name, created_at)
            VALUES (location_name, NOW())
            ON CONFLICT (name) DO NOTHING;
            
            RAISE NOTICE '创建地点: %', location_name;
        END IF;
    END LOOP;
END;
$$;

-- 8. 执行地点数据修复（如果需要）
-- SELECT public.fix_missing_locations();

-- 9. 验证修复结果
SELECT 
    COUNT(*) as total_locations,
    COUNT(CASE WHEN name LIKE '%仓库%' THEN 1 END) as warehouse_locations,
    COUNT(CASE WHEN name LIKE '%北京%' THEN 1 END) as beijing_locations,
    COUNT(CASE WHEN name LIKE '%上海%' THEN 1 END) as shanghai_locations
FROM locations;
