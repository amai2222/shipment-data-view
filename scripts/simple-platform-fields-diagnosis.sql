-- 简单的平台字段诊断脚本
-- 避免GROUP BY错误，分步检查

-- 1. 检查字段是否存在
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
AND table_schema = 'public'
AND column_name IN ('external_tracking_numbers', 'other_platform_names')
ORDER BY column_name;

-- 2. 检查external_tracking_numbers字段
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as has_external_tracking,
    COUNT(CASE WHEN external_tracking_numbers IS NULL THEN 1 END) as null_external_tracking
FROM logistics_records;

-- 3. 检查other_platform_names字段
SELECT 
    COUNT(*) as total_records,
    COUNT(other_platform_names) as has_other_platform_names,
    COUNT(CASE WHEN other_platform_names IS NULL THEN 1 END) as null_other_platform_names
FROM logistics_records;

-- 4. 查看external_tracking_numbers的示例数据
SELECT 
    auto_number,
    external_tracking_numbers,
    LENGTH(external_tracking_numbers::text) as json_length
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;

-- 5. 查看other_platform_names的示例数据
SELECT 
    auto_number,
    other_platform_names,
    array_length(other_platform_names, 1) as array_length
FROM logistics_records 
WHERE other_platform_names IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;

-- 6. 检查数据类型
SELECT 
    'external_tracking_numbers' as field_name,
    pg_typeof(external_tracking_numbers) as data_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL
LIMIT 1;

SELECT 
    'other_platform_names' as field_name,
    pg_typeof(other_platform_names) as data_type
FROM logistics_records 
WHERE other_platform_names IS NOT NULL
LIMIT 1;

-- 7. 测试JSON格式
DO $$
DECLARE
    rec RECORD;
    error_count integer := 0;
    total_count integer := 0;
BEGIN
    FOR rec IN 
        SELECT auto_number, external_tracking_numbers
        FROM logistics_records 
        WHERE external_tracking_numbers IS NOT NULL
        LIMIT 5
    LOOP
        total_count := total_count + 1;
        BEGIN
            PERFORM rec.external_tracking_numbers::jsonb;
            RAISE NOTICE '✅ % - external_tracking_numbers格式正确', rec.auto_number;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '❌ % - external_tracking_numbers格式错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '检查了 % 条记录，发现 % 条格式错误', total_count, error_count;
END $$;

-- 8. 检查最近导入的记录
SELECT 
    auto_number,
    project_name,
    CASE 
        WHEN external_tracking_numbers IS NOT NULL THEN '有外部运单号'
        ELSE '无外部运单号'
    END as external_tracking_status,
    CASE 
        WHEN other_platform_names IS NOT NULL THEN '有其他平台'
        ELSE '无其他平台'
    END as other_platform_status,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;
