-- 验证方案1：UTC存储标准方案的修复效果（修正版本）
-- 测试验重函数和导入函数是否正确处理时区

-- 1. 检查当前数据时区状态
SELECT '=== 当前数据时区状态 ===' as test_title;
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    CASE 
        WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN 'UTC时区（标准）'
        WHEN EXTRACT(timezone_hour FROM loading_date) = 8 THEN '中国时区（需要转换）'
        ELSE '其他时区'
    END as status
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 2. 显示示例数据
SELECT '=== 示例数据 ===' as test_title;
SELECT 
    auto_number,
    loading_date,
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    loading_date AT TIME ZONE 'Asia/Shanghai' as china_time,
    loading_date AT TIME ZONE 'UTC' as utc_time
FROM logistics_records 
WHERE loading_date IS NOT NULL
ORDER BY created_at DESC 
LIMIT 3;

-- 3. 测试验重函数 - 使用您的实际数据
SELECT '=== 测试验重函数（UTC方案）===' as test_title;
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
            "remarks": "测试UTC标准方案"
        }
    ]'::jsonb
) as test_result;

-- 4. 测试时区转换逻辑（修正语法）
SELECT '=== 时区转换测试 ===' as test_title;
SELECT 
    '2025-09-05' as input_date,
    ('2025-09-05 00:00:00+08:00')::timestamptz as china_timezone,
    ('2025-09-05 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC' as converted_to_utc,
    (('2025-09-05 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC')::date as utc_date_part;

-- 5. 验证数据库中的实际比较
SELECT '=== 数据库比较验证 ===' as test_title;
SELECT 
    lr.auto_number,
    lr.loading_date,
    lr.loading_date::date as db_date_part,
    '2025-09-05'::date as input_date_part,
    lr.loading_date::date = '2025-09-05'::date as date_match,
    lr.project_name,
    lr.driver_name,
    lr.license_plate
FROM logistics_records lr
WHERE lr.project_name = '云南郝文学车队'
AND lr.driver_name = '李永峰'
AND lr.license_plate = '云G04011D'
LIMIT 3;

-- 6. 测试导入函数的时区处理（修正语法）
SELECT '=== 导入函数时区处理测试 ===' as test_title;
WITH test_import AS (
    SELECT 
        '2025-09-06' as loading_date_str,
        ('2025-09-06 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC' as loading_date_utc,
        (('2025-09-06 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC')::date as loading_date_date_part
)
SELECT 
    loading_date_str,
    loading_date_utc,
    loading_date_date_part,
    EXTRACT(timezone_hour FROM loading_date_utc) as timezone_offset
FROM test_import;

-- 7. 测试新数据导入（模拟）
SELECT '=== 新数据导入测试 ===' as test_title;
SELECT public.batch_import_logistics_records(
    '[
        {
            "project_name": "云南郝文学车队",
            "chain_name": "",
            "driver_name": "测试司机",
            "license_plate": "测试车牌",
            "driver_phone": "13800000000",
            "loading_location": "测试装货地",
            "unloading_location": "测试卸货地",
            "loading_date": "2025-01-21",
            "unloading_date": "2025-01-21",
            "loading_weight": "10",
            "unloading_weight": "10",
            "current_cost": "100",
            "extra_cost": "0",
            "transport_type": "实际运输",
            "remarks": "UTC方案测试数据"
        }
    ]'::jsonb
) as import_test_result;

-- 8. 验证最终结果
SELECT '=== 最终验证 ===' as test_title;
SELECT 
    'UTC标准方案测试完成' as result,
    '数据库存储UTC时间，验重时转换为UTC比较' as approach,
    '符合行业标准做法' as standard,
    '验重功能应该正常工作' as expected_behavior;
