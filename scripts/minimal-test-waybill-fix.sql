-- 最小化测试脚本 - 避免限流问题
-- 只检查关键功能，不进行复杂查询

-- 1. 检查函数是否存在
SELECT 
    proname as function_name,
    CASE WHEN proname = 'get_logistics_summary_and_records' THEN '✓' ELSE '✗' END as status
FROM pg_proc 
WHERE proname IN ('get_logistics_summary_and_records', 'import_logistics_data');

-- 2. 检查表结构
SELECT 
    column_name,
    data_type,
    CASE WHEN column_name IN ('external_tracking_numbers', 'other_platform_names') THEN '✓' ELSE '✗' END as platform_field
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
AND column_name IN ('external_tracking_numbers', 'other_platform_names');

-- 3. 简单测试运单查询（只查询一条记录）
SELECT 
    auto_number,
    driver_name,
    driver_phone,
    license_plate,
    loading_location,
    unloading_location,
    CASE WHEN external_tracking_numbers IS NOT NULL THEN '✓' ELSE '✗' END as has_external_tracking,
    CASE WHEN other_platform_names IS NOT NULL THEN '✓' ELSE '✗' END as has_platform_names
FROM logistics_records 
LIMIT 1;
