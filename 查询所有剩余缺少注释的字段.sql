-- ============================================================================
-- 查询整个数据库中所有还缺少中文注释的字段
-- ============================================================================

-- 统计总体情况
SELECT 
    '📊 数据库字段注释覆盖率' as 统计类型,
    COUNT(*) as 总字段数,
    COUNT(pgd.description) as 有注释字段数,
    COUNT(*) - COUNT(pgd.description) as 缺少注释字段数,
    ROUND((COUNT(pgd.description)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as 注释覆盖率百分比
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = t.table_name
LEFT JOIN pg_catalog.pg_description pgd ON (
    pgd.objoid = st.relid 
    AND pgd.objsubid = c.ordinal_position
)
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name NOT LIKE 'pg_%'
AND t.table_name NOT LIKE '%backup%';  -- 排除备份表

-- 按表统计缺少注释的情况（只显示有缺失的表）
SELECT 
    '📋 各表缺少注释统计（按缺失数量排序）' as 说明;

SELECT 
    t.table_name as 表名,
    COUNT(*) as 总字段数,
    COUNT(pgd.description) as 有注释,
    COUNT(*) - COUNT(pgd.description) as 缺少注释,
    ROUND((COUNT(pgd.description)::NUMERIC / COUNT(*) * 100), 1) as 注释覆盖率
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = t.table_name
LEFT JOIN pg_catalog.pg_description pgd ON (
    pgd.objoid = st.relid 
    AND pgd.objsubid = c.ordinal_position
)
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name NOT LIKE 'pg_%'
AND t.table_name NOT LIKE '%backup%'
GROUP BY t.table_name
HAVING COUNT(*) - COUNT(pgd.description) > 0
ORDER BY 缺少注释 DESC;

-- 列出所有缺少注释的字段（用于生成COMMENT语句）
SELECT 
    '📝 所有缺少注释的字段列表' as 说明;

SELECT 
    t.table_name as 表名,
    c.column_name as 字段名,
    c.data_type as 数据类型,
    c.is_nullable as 可为空,
    'COMMENT ON COLUMN ' || t.table_name || '.' || c.column_name || ' IS ''TODO: 添加中文注释'';' as 生成的SQL语句模板
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = t.table_name
LEFT JOIN pg_catalog.pg_description pgd ON (
    pgd.objoid = st.relid 
    AND pgd.objsubid = c.ordinal_position
)
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name NOT LIKE 'pg_%'
AND t.table_name NOT LIKE '%backup%'
AND pgd.description IS NULL
ORDER BY 
    t.table_name,
    c.ordinal_position;

