-- 检查 project_partners 表结构和数据

-- 1. 查看表结构
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'project_partners'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 查看数据示例（前10条）
SELECT 
    pp.id,
    pp.project_id,
    pp.partner_id,
    p.name AS project_name,
    pa.name AS partner_name,
    pa.partner_type
FROM project_partners pp
LEFT JOIN projects p ON p.id = pp.project_id
LEFT JOIN partners pa ON pa.id = pp.partner_id
LIMIT 10;

-- 3. 统计货主关联的项目数
SELECT 
    pa.name AS 货主名称,
    pa.partner_type,
    COUNT(pp.project_id) AS 关联项目数
FROM partners pa
LEFT JOIN project_partners pp ON pp.partner_id = pa.id
WHERE pa.partner_type = '货主'
GROUP BY pa.id, pa.name, pa.partner_type
ORDER BY 关联项目数 DESC;

