-- ==========================================
-- 验证 chain_id 填充结果
-- ==========================================

-- 1. 总体统计
SELECT 
    '总运单数' as "统计项",
    COUNT(*) as "数量",
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM logistics_records), 2) || '%' as "占比"
FROM logistics_records
UNION ALL
SELECT 
    'chain_id 有值',
    COUNT(*),
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM logistics_records), 2) || '%'
FROM logistics_records
WHERE chain_id IS NOT NULL
UNION ALL
SELECT 
    'chain_id 为 NULL',
    COUNT(*),
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM logistics_records), 2) || '%'
FROM logistics_records
WHERE chain_id IS NULL;

-- 2. 检查是否还有 NULL 的情况
SELECT 
    lr.auto_number as "运单编号",
    lr.project_name as "项目",
    lr.chain_id as "chain_id",
    lr.project_id as "项目ID",
    CASE 
        WHEN lr.project_id IS NULL THEN '❌ 项目ID为空'
        WHEN NOT EXISTS (SELECT 1 FROM partner_chains WHERE project_id = lr.project_id) THEN '❌ 项目没有链路'
        ELSE '⚠️  其他原因'
    END as "原因"
FROM logistics_records lr
WHERE lr.chain_id IS NULL
ORDER BY lr.loading_date DESC
LIMIT 20;

-- 3. 验证填充的 chain_id 是否正确
SELECT 
    lr.project_name as "项目",
    lr.chain_name as "链路名称",
    COUNT(*) as "运单数量",
    COUNT(DISTINCT lr.chain_id) as "使用的链路数"
FROM logistics_records lr
WHERE lr.chain_id IS NOT NULL
GROUP BY lr.project_name, lr.chain_name
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 4. 检查是否有运单的 chain_id 不匹配项目的链路
SELECT 
    lr.auto_number as "运单编号",
    lr.project_name as "运单的项目",
    pc.chain_name as "chain_id对应的链路",
    p.name as "链路所属项目"
FROM logistics_records lr
JOIN partner_chains pc ON lr.chain_id = pc.id
JOIN projects p ON pc.project_id = p.id
WHERE lr.project_id != pc.project_id
LIMIT 10;
