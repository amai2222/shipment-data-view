-- 快速查询：统计需要修复的记录数
SELECT 
    COUNT(*) AS 需要修复的记录数,
    SUM(payable_cost) AS 总金额,
    AVG(payable_cost) AS 平均金额
FROM logistics_records
WHERE 
    (calculation_mode = 'manual' OR calculation_mode IS NULL)
    AND payable_cost IS NOT NULL
    AND payable_cost != FLOOR(payable_cost)
    AND current_cost IS NOT NULL
    AND current_cost = FLOOR(current_cost);

