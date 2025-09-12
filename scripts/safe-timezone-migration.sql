-- 安全的时区迁移脚本
-- 包含备份、验证和回滚选项

-- ========================================
-- 第一步：备份现有数据
-- ========================================

-- 1. 创建备份表
CREATE TABLE IF NOT EXISTS logistics_records_timezone_backup AS 
SELECT 
    *,
    NOW() as backup_created_at,
    'before_timezone_migration' as backup_reason
FROM logistics_records;

-- 2. 验证备份
SELECT '=== 备份验证 ===' as step_title;
SELECT 
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM logistics_records_timezone_backup) as backup_count,
    CASE 
        WHEN COUNT(*) = (SELECT COUNT(*) FROM logistics_records_timezone_backup)
        THEN '✓ 备份成功'
        ELSE '✗ 备份失败'
    END as backup_status
FROM logistics_records;

-- ========================================
-- 第二步：检查当前时区状态
-- ========================================

SELECT '=== 当前时区状态检查 ===' as step_title;

-- 检查时区分布
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    MIN(loading_date) as min_date,
    MAX(loading_date) as max_date
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 检查具体示例
SELECT 
    '示例数据' as data_type,
    auto_number,
    loading_date,
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    loading_date AT TIME ZONE 'Asia/Shanghai' as china_time,
    loading_date AT TIME ZONE 'UTC' as utc_time
FROM logistics_records 
WHERE loading_date IS NOT NULL
ORDER BY created_at DESC 
LIMIT 3;

-- ========================================
-- 第三步：执行时区转换（谨慎执行）
-- ========================================

-- 注意：以下UPDATE语句会修改现有数据
-- 请确认备份成功后再执行

/*
-- 取消注释以下代码来执行时区转换
UPDATE logistics_records 
SET 
    loading_date = loading_date AT TIME ZONE 'Asia/Shanghai',
    unloading_date = CASE 
        WHEN unloading_date IS NOT NULL 
        THEN unloading_date AT TIME ZONE 'Asia/Shanghai'
        ELSE NULL 
    END,
    updated_at = NOW()
WHERE loading_date IS NOT NULL;
*/

-- ========================================
-- 第四步：验证转换结果
-- ========================================

SELECT '=== 转换后验证 ===' as step_title;

-- 检查转换后的时区分布
SELECT 
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    COUNT(*) as record_count,
    CASE 
        WHEN EXTRACT(timezone_hour FROM loading_date) = 8
        THEN '✓ 中国时区'
        ELSE '✗ 其他时区'
    END as timezone_status
FROM logistics_records 
WHERE loading_date IS NOT NULL
GROUP BY EXTRACT(timezone_hour FROM loading_date)
ORDER BY timezone_offset;

-- 检查转换后的示例
SELECT 
    '转换后示例' as data_type,
    auto_number,
    loading_date,
    EXTRACT(timezone_hour FROM loading_date) as timezone_offset,
    loading_date AT TIME ZONE 'Asia/Shanghai' as china_time,
    loading_date AT TIME ZONE 'UTC' as utc_time
FROM logistics_records 
WHERE loading_date IS NOT NULL
ORDER BY created_at DESC 
LIMIT 3;

-- ========================================
-- 第五步：回滚脚本（如果需要）
-- ========================================

-- 如果需要回滚，执行以下代码：
/*
-- 回滚到备份数据
DELETE FROM logistics_records;
INSERT INTO logistics_records 
SELECT 
    id, auto_number, project_id, project_name, chain_id, billing_type_id, driver_id, driver_name,
    loading_location, unloading_location, loading_date, unloading_date,
    loading_weight, unloading_weight, current_cost, extra_cost,
    license_plate, driver_phone, transport_type, remarks, payable_cost,
    created_by_user_id, created_at, updated_at
FROM logistics_records_timezone_backup;
*/

-- ========================================
-- 第六步：清理备份（确认无误后执行）
-- ========================================

-- 确认转换成功后，可以删除备份表：
/*
DROP TABLE IF EXISTS logistics_records_timezone_backup;
*/

-- ========================================
-- 执行说明
-- ========================================

SELECT '=== 执行说明 ===' as instruction_title;
SELECT 
    '1. 首先执行此脚本检查当前状态' as step_1,
    '2. 确认备份成功' as step_2,
    '3. 取消注释UPDATE语句执行转换' as step_3,
    '4. 验证转换结果' as step_4,
    '5. 如有问题，使用回滚脚本' as step_5,
    '6. 确认无误后删除备份表' as step_6;
