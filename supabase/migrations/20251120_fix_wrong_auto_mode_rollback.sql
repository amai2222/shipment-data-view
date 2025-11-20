-- ============================================================================
-- 修复错误：将被错误标记为auto的历史数据改回manual
-- 日期：2025-11-20
-- 说明：历史数据中，即使有单价，也应该是manual模式（因为是反推的）
--       只有明确通过前端自动计算模式创建的，才应该是auto
-- ============================================================================

-- 策略：将所有历史数据（在2025-11-20之前创建的）都改为manual
-- 因为历史数据都是手动输入的，即使有单价也是反推的

UPDATE public.logistics_records
SET calculation_mode = 'manual'
WHERE calculation_mode = 'auto'
    AND created_at < '2025-11-20 00:00:00+08:00'::timestamptz;

-- 显示修复结果
SELECT 
    '修复完成' as 状态,
    COUNT(*) as 总运单数,
    COUNT(CASE WHEN calculation_mode = 'auto' THEN 1 END) as 自动模式数量,
    COUNT(CASE WHEN calculation_mode = 'manual' THEN 1 END) as 手动模式数量,
    COUNT(CASE WHEN calculation_mode IS NULL THEN 1 END) as 未设置模式数量
FROM public.logistics_records;

-- 显示修复的详细统计
SELECT 
    '修复详情' as 说明,
    COUNT(*) as 被修复的记录数,
    MIN(created_at) as 最早记录,
    MAX(created_at) as 最晚记录
FROM public.logistics_records
WHERE calculation_mode = 'manual'
    AND created_at < '2025-11-20 00:00:00+08:00'::timestamptz
    AND unit_price IS NOT NULL
    AND unit_price > 0;

