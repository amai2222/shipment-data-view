-- ============================================================================
-- 查看当前auto模式记录统计
-- 日期：2025-11-20
-- ============================================================================

-- 总体统计
SELECT 
    '总体统计' as 类型,
    COUNT(*) as 总运单数,
    COUNT(CASE WHEN calculation_mode = 'auto' THEN 1 END) as 自动模式数量,
    COUNT(CASE WHEN calculation_mode = 'manual' THEN 1 END) as 手动模式数量,
    COUNT(CASE WHEN calculation_mode IS NULL THEN 1 END) as 未设置模式数量,
    ROUND(100.0 * COUNT(CASE WHEN calculation_mode = 'auto' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as 自动模式占比_百分比
FROM public.logistics_records;

-- 按创建时间分组统计（查看auto模式的分布）
SELECT 
    DATE(created_at AT TIME ZONE 'Asia/Shanghai') as 创建日期,
    COUNT(*) as 总数量,
    COUNT(CASE WHEN calculation_mode = 'auto' THEN 1 END) as 自动模式数量,
    COUNT(CASE WHEN calculation_mode = 'manual' THEN 1 END) as 手动模式数量,
    COUNT(CASE WHEN calculation_mode IS NULL THEN 1 END) as 未设置数量
FROM public.logistics_records
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Shanghai')
ORDER BY 创建日期 DESC
LIMIT 30;

-- 查看auto模式记录的详细信息（最近20条）
SELECT 
    id,
    auto_number as 运单号,
    DATE(created_at AT TIME ZONE 'Asia/Shanghai') as 创建日期,
    calculation_mode as 计算模式,
    ROUND(unit_price::numeric, 2) as 单价,
    ROUND(effective_quantity::numeric, 2) as 有效数量,
    ROUND(current_cost::numeric, 2) as 运费,
    project_name as 项目名称
FROM public.logistics_records
WHERE calculation_mode = 'auto'
ORDER BY created_at DESC
LIMIT 20;

