-- ============================================================================
-- 修复可口可乐项目的运单金额：四舍五入到整数
-- 创建时间: 2025-11-22
-- 说明：将所有项目名称为"可口可乐"的运单，current_cost按整数四舍五入
-- 例如：1900.1 → 1900, 1899.6 → 1900
-- ============================================================================

-- 第一步：查看需要修复的记录数（预览）
SELECT 
    COUNT(*) AS 需要修复的记录数,
    COUNT(*) FILTER (WHERE current_cost != ROUND(current_cost, 0)) AS 有小数需要四舍五入的记录数,
    SUM(current_cost) AS 修复前总金额,
    SUM(ROUND(current_cost, 0)) AS 修复后总金额,
    SUM(current_cost) - SUM(ROUND(current_cost, 0)) AS 总差异
FROM logistics_records
WHERE project_name = '可口可乐'
AND current_cost IS NOT NULL;

-- 第二步：查看详细记录（前20条，修复前后对比）
SELECT 
    id,
    auto_number AS 运单编号,
    driver_name AS 司机姓名,
    current_cost AS 修复前金额,
    ROUND(current_cost, 0) AS 修复后金额,
    current_cost - ROUND(current_cost, 0) AS 差异,
    extra_cost AS 额外费,
    payable_cost AS 当前司机应收,
    (ROUND(current_cost, 0) + COALESCE(extra_cost, 0)) AS 修复后司机应收
FROM logistics_records
WHERE project_name = '可口可乐'
AND current_cost IS NOT NULL
AND current_cost != ROUND(current_cost, 0)  -- 只显示有小数需要修复的
ORDER BY current_cost DESC
LIMIT 20;

-- 第三步：执行修复（更新current_cost）
UPDATE logistics_records
SET 
    current_cost = ROUND(current_cost, 0),
    -- 同时更新payable_cost = current_cost + extra_cost
    payable_cost = ROUND(current_cost, 0) + COALESCE(extra_cost, 0)
WHERE project_name = '可口可乐'
AND current_cost IS NOT NULL
AND current_cost != ROUND(current_cost, 0);  -- 只更新有小数需要修复的记录

-- 第四步：验证修复结果
SELECT 
    COUNT(*) AS 总记录数,
    COUNT(*) FILTER (WHERE current_cost = ROUND(current_cost, 0)) AS 已修复为整数的记录数,
    COUNT(*) FILTER (WHERE current_cost != ROUND(current_cost, 0)) AS 仍有小数的记录数
FROM logistics_records
WHERE project_name = '可口可乐'
AND current_cost IS NOT NULL;

