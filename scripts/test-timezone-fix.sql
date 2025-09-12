-- 测试时区修复是否生效
-- 验证验重函数和导入函数是否正确处理中国时区

-- 1. 测试验重函数 - 使用您的实际数据
SELECT '=== 测试验重函数（时区修复后）===' as test_title;

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
            "remarks": "测试时区修复"
        }
    ]'::jsonb
) as test_result;

-- 2. 检查数据库中的实际数据
SELECT '=== 检查数据库中的实际数据 ===' as test_title;

SELECT 
    auto_number,
    project_name,
    driver_name,
    license_plate,
    loading_location,
    unloading_location,
    loading_date,
    loading_date::date as loading_date_only,
    loading_weight,
    created_at
FROM logistics_records 
WHERE project_name = '云南郝文学车队'
AND driver_name = '李永峰'
AND license_plate = '云G04011D'
ORDER BY created_at DESC
LIMIT 5;

-- 3. 测试时区转换函数
SELECT '=== 测试时区转换函数 ===' as test_title;

SELECT 
    '2025-09-05' as input_date,
    ('2025-09-05 00:00:00+08:00')::timestamptz as china_timezone,
    public.to_china_timezone(('2025-09-05 00:00:00+08:00')::timestamptz) as converted_time,
    public.format_china_date(('2025-09-05 00:00:00+08:00')::timestamptz) as formatted_date;

-- 4. 比较不同时区的日期
SELECT '=== 比较不同时区的日期 ===' as test_title;

SELECT 
    'UTC时间' as timezone_type,
    '2025-09-05 00:00:00+00:00'::timestamptz as timestamp_value,
    ('2025-09-05 00:00:00+00:00')::timestamptz::date as date_part
UNION ALL
SELECT 
    '中国时区' as timezone_type,
    '2025-09-05 00:00:00+08:00'::timestamptz as timestamp_value,
    ('2025-09-05 00:00:00+08:00')::timestamptz::date as date_part;

-- 5. 测试日期比较逻辑
SELECT '=== 测试日期比较逻辑 ===' as test_title;

SELECT 
    lr.loading_date::date as db_date,
    '2025-09-05'::date as input_date,
    lr.loading_date::date = '2025-09-05'::date as date_match,
    lr.auto_number,
    lr.project_name,
    lr.driver_name
FROM logistics_records lr
WHERE lr.project_name = '云南郝文学车队'
AND lr.driver_name = '李永峰'
AND lr.license_plate = '云G04011D'
LIMIT 3;

-- 6. 验证导入函数的时区处理
SELECT '=== 验证导入函数的时区处理 ===' as test_title;

-- 模拟导入一条新记录（不实际插入）
WITH test_import AS (
    SELECT 
        '2025-09-06' as loading_date_str,
        ('2025-09-06 00:00:00+08:00')::timestamptz as loading_date_parsed,
        ('2025-09-06 00:00:00+08:00')::timestamptz::date as loading_date_date
)
SELECT 
    loading_date_str,
    loading_date_parsed,
    loading_date_date,
    loading_date_parsed AT TIME ZONE 'Asia/Shanghai' as china_timezone
FROM test_import;
