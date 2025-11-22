-- ============================================================================
-- 查询因单价计算导致变成小数的记录
-- 创建时间: 2025-11-22
-- ============================================================================

-- 查询1：统计需要修复的记录数
SELECT 
    COUNT(*) AS 需要修复的记录数,
    SUM(payable_cost) AS 总金额,
    AVG(payable_cost) AS 平均金额
FROM logistics_records
WHERE 
    -- manual模式或未设置模式
    (calculation_mode = 'manual' OR calculation_mode IS NULL)
    -- payable_cost是小数
    AND payable_cost IS NOT NULL
    AND payable_cost != FLOOR(payable_cost)
    -- current_cost是整数（说明原本应该是整数）
    AND current_cost IS NOT NULL
    AND current_cost = FLOOR(current_cost);

-- 查询2：详细查看需要修复的记录（前20条）
SELECT 
    id,
    auto_number AS 运单编号,
    project_name AS 项目名称,
    driver_name AS 司机姓名,
    current_cost AS 运费,
    extra_cost AS 额外费,
    payable_cost AS 司机应收,
    unit_price AS 单价,
    effective_quantity AS 有效数量,
    calculation_mode AS 计算模式,
    -- 计算应该的payable_cost
    (current_cost + COALESCE(extra_cost, 0)) AS 应该的司机应收,
    -- 差异
    payable_cost - (current_cost + COALESCE(extra_cost, 0)) AS 差异金额
FROM logistics_records
WHERE 
    (calculation_mode = 'manual' OR calculation_mode IS NULL)
    AND payable_cost IS NOT NULL
    AND payable_cost != FLOOR(payable_cost)
    AND current_cost IS NOT NULL
    AND current_cost = FLOOR(current_cost)
ORDER BY payable_cost DESC
LIMIT 20;

-- 查询3：按项目分组统计
SELECT 
    project_name AS 项目名称,
    COUNT(*) AS 需要修复的记录数,
    SUM(payable_cost) AS 总金额,
    MIN(payable_cost) AS 最小金额,
    MAX(payable_cost) AS 最大金额
FROM logistics_records
WHERE 
    (calculation_mode = 'manual' OR calculation_mode IS NULL)
    AND payable_cost IS NOT NULL
    AND payable_cost != FLOOR(payable_cost)
    AND current_cost IS NOT NULL
    AND current_cost = FLOOR(current_cost)
GROUP BY project_name
ORDER BY COUNT(*) DESC;

-- 查询4：查看所有模式的数据统计
SELECT 
    COALESCE(calculation_mode, 'NULL') AS 计算模式,
    COUNT(*) AS 总记录数,
    COUNT(*) FILTER (WHERE payable_cost != FLOOR(payable_cost)) AS 小数金额记录数,
    COUNT(*) FILTER (WHERE payable_cost = FLOOR(payable_cost)) AS 整数金额记录数,
    ROUND(100.0 * COUNT(*) FILTER (WHERE payable_cost != FLOOR(payable_cost)) / COUNT(*), 2) AS 小数比例
FROM logistics_records
WHERE payable_cost IS NOT NULL
GROUP BY calculation_mode
ORDER BY calculation_mode;

