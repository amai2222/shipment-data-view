-- 检查数据库时区设置和日期字段类型
-- 确认当前状态，为时区统一做准备

-- 1. 检查数据库时区设置
SELECT '=== 数据库时区设置 ===' as check_title;
SELECT 
    name,
    setting,
    unit,
    context
FROM pg_settings 
WHERE name IN ('timezone', 'log_timezone', 'TimeZone');

-- 2. 检查logistics_records表的日期字段类型
SELECT '=== logistics_records表字段类型 ===' as check_title;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
AND column_name IN ('loading_date', 'unloading_date', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- 3. 检查现有数据的时区情况
SELECT '=== 现有数据的时区情况 ===' as check_title;
SELECT 
    auto_number,
    loading_date,
    loading_date AT TIME ZONE 'UTC' as loading_date_utc,
    loading_date AT TIME ZONE 'Asia/Shanghai' as loading_date_china,
    unloading_date,
    unloading_date AT TIME ZONE 'UTC' as unloading_date_utc,
    unloading_date AT TIME ZONE 'Asia/Shanghai' as unloading_date_china,
    created_at,
    created_at AT TIME ZONE 'UTC' as created_at_utc,
    created_at AT TIME ZONE 'Asia/Shanghai' as created_at_china
FROM logistics_records 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. 检查时区偏移情况
SELECT '=== 时区偏移分析 ===' as check_title;
SELECT 
    'UTC时区' as timezone_type,
    COUNT(*) as record_count,
    MIN(loading_date) as min_date,
    MAX(loading_date) as max_date
FROM logistics_records
WHERE loading_date AT TIME ZONE 'UTC' = loading_date
UNION ALL
SELECT 
    '中国时区' as timezone_type,
    COUNT(*) as record_count,
    MIN(loading_date) as min_date,
    MAX(loading_date) as max_date
FROM logistics_records
WHERE loading_date AT TIME ZONE 'Asia/Shanghai' = loading_date;

-- 5. 检查具体日期的时区表示
SELECT '=== 具体日期时区表示 ===' as check_title;
SELECT 
    loading_date,
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset_hours,
    loading_date::text as date_text,
    loading_date AT TIME ZONE 'Asia/Shanghai' as china_time,
    loading_date AT TIME ZONE 'UTC' as utc_time
FROM logistics_records 
WHERE loading_date IS NOT NULL
ORDER BY created_at DESC 
LIMIT 3;
