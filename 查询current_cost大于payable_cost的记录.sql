-- ============================================================================
-- 查询 current_cost > payable_cost 的记录数量
-- ============================================================================

-- 方案1：只查询数量
SELECT COUNT(*) AS 需要更新的记录数
FROM public.logistics_records
WHERE current_cost IS NOT NULL
  AND payable_cost IS NOT NULL
  AND current_cost > payable_cost;

-- 方案2：查看详细记录（带运单号和差额）
SELECT 
    auto_number AS 运单号,
    current_cost AS 当前成本,
    payable_cost AS 应付成本,
    (current_cost - payable_cost) AS 差额
FROM public.logistics_records
WHERE current_cost IS NOT NULL
  AND payable_cost IS NOT NULL
  AND current_cost > payable_costa
ORDER BY (current_cost - payable_cost) DESC;

-- 方案3：统计汇总（按差额分组）
SELECT 
    COUNT(*) AS 记录数,
    SUM(current_cost - payable_cost) AS 总差额,
    AVG(current_cost - payable_cost) AS 平均差额,
    MAX(current_cost - payable_cost) AS 最大差额,
    MIN(current_cost - payable_cost) AS 最小差额
FROM public.logistics_records
WHERE current_cost IS NOT NULL
  AND payable_cost IS NOT NULL
  AND current_cost > payable_cost;

