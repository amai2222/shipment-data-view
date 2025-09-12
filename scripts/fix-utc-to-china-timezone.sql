-- 修正所有UTC时间记录为中国时间
-- 将 2025-08-10 00:00:00+00 格式的记录修正为 2025-08-10 00:00:00+08:00

-- 1. 检查需要修正的记录数量
SELECT '=== 需要修正的记录统计 ===' as status_title;
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    CASE 
        WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN '需要修正为+08'
        WHEN EXTRACT(timezone_hour FROM loading_date) = 8 THEN '已经是中国时区'
        ELSE '其他时区'
    END as status
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 2. 显示需要修正的示例记录
SELECT '=== 修正前示例 ===' as status_title;
SELECT 
    auto_number,
    loading_date,
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    loading_date AT TIME ZONE 'Asia/Shanghai' as china_time
FROM logistics_records 
WHERE EXTRACT(timezone_hour FROM loading_date) = 0
ORDER BY created_at DESC 
LIMIT 5;

-- 3. 执行修正：将所有UTC时间记录转换为中国时区
UPDATE logistics_records 
SET 
    loading_date = loading_date AT TIME ZONE 'Asia/Shanghai',
    unloading_date = CASE 
        WHEN unloading_date IS NOT NULL 
        THEN unloading_date AT TIME ZONE 'Asia/Shanghai'
        ELSE NULL 
    END,
    updated_at = NOW()
WHERE EXTRACT(timezone_hour FROM loading_date) = 0;

-- 4. 验证修正结果
SELECT '=== 修正后统计 ===' as status_title;
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    CASE 
        WHEN EXTRACT(timezone_hour FROM loading_date) = 8 THEN '✓ 已修正为中国时区'
        WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN '✗ 仍为UTC时区'
        ELSE '其他时区'
    END as status
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 5. 显示修正后的示例记录
SELECT '=== 修正后示例 ===' as status_title;
SELECT 
    auto_number,
    loading_date,
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    loading_date AT TIME ZONE 'Asia/Shanghai' as china_time
FROM logistics_records 
WHERE loading_date IS NOT NULL
ORDER BY created_at DESC 
LIMIT 5;

-- 6. 最终验证
SELECT '=== 最终验证 ===' as status_title;
SELECT 
    '修正完成' as result,
    COUNT(*) as total_records,
    COUNT(CASE WHEN EXTRACT(timezone_hour FROM loading_date) = 8 THEN 1 END) as china_timezone_records,
    COUNT(CASE WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN 1 END) as utc_timezone_records,
    CASE 
        WHEN COUNT(CASE WHEN EXTRACT(timezone_hour FROM loading_date) = 0 THEN 1 END) = 0
        THEN '✓ 所有记录已修正为中国时区'
        ELSE '✗ 仍有UTC时区记录需要修正'
    END as final_status
FROM logistics_records 
WHERE loading_date IS NOT NULL;
