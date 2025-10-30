-- ==========================================
-- 检查 chain_id 缺失情况
-- ==========================================

-- 1. 统计 chain_id 为 NULL 的运单数量
SELECT 
    '总运单数' as "统计项",
    COUNT(*) as "数量"
FROM logistics_records
UNION ALL
SELECT 
    'chain_id 为 NULL',
    COUNT(*)
FROM logistics_records
WHERE chain_id IS NULL
UNION ALL
SELECT 
    'chain_id 有值',
    COUNT(*)
FROM logistics_records
WHERE chain_id IS NOT NULL;

-- 2. 按项目统计 chain_id 为 NULL 的运单
SELECT 
    lr.project_name as "项目名称",
    COUNT(*) as "缺失 chain_id 的运单数",
    MIN(lr.loading_date) as "最早装货日期",
    MAX(lr.loading_date) as "最晚装货日期"
FROM logistics_records lr
WHERE lr.chain_id IS NULL
GROUP BY lr.project_name
ORDER BY COUNT(*) DESC;

-- 3. 检查这些项目是否有可用的链路
SELECT 
    p.name as "项目名称",
    COUNT(DISTINCT pc.id) as "链路数量",
    array_agg(DISTINCT pc.chain_name ORDER BY pc.chain_name) as "链路列表"
FROM projects p
LEFT JOIN partner_chains pc ON p.id = pc.project_id
WHERE p.id IN (
    SELECT DISTINCT project_id 
    FROM logistics_records 
    WHERE chain_id IS NULL AND project_id IS NOT NULL
)
GROUP BY p.id, p.name
ORDER BY "链路数量" DESC, p.name;

-- 4. 预览将要填充的数据（前10条）
SELECT 
    lr.auto_number as "运单编号",
    lr.project_name as "项目",
    lr.chain_id as "当前chain_id",
    (
        SELECT pc.id
        FROM partner_chains pc
        WHERE pc.project_id = lr.project_id
        ORDER BY pc.created_at ASC
        LIMIT 1
    ) as "默认链路ID",
    (
        SELECT pc.chain_name
        FROM partner_chains pc
        WHERE pc.project_id = lr.project_id
        ORDER BY pc.created_at ASC
        LIMIT 1
    ) as "默认链路名称"
FROM logistics_records lr
WHERE lr.chain_id IS NULL
  AND lr.project_id IS NOT NULL
LIMIT 10;
