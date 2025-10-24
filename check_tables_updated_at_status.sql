-- ============================================================
-- 检查所有表的 updated_at 字段状态
-- 功能：显示每个表是否有 updated_at 字段和触发器
-- ============================================================

-- 显示所有表的 updated_at 字段状态
SELECT 
    t.tablename AS "表名",
    CASE 
        WHEN c.column_name IS NOT NULL THEN '✅ 有' 
        ELSE '❌ 无' 
    END AS "updated_at字段",
    CASE 
        WHEN tr.trigger_name IS NOT NULL THEN '✅ 有' 
        ELSE '❌ 无' 
    END AS "updated_at触发器",
    CASE 
        WHEN c.column_name IS NOT NULL AND tr.trigger_name IS NOT NULL THEN '✅ 完整'
        WHEN c.column_name IS NOT NULL AND tr.trigger_name IS NULL THEN '⚠️ 缺少触发器'
        WHEN c.column_name IS NULL AND tr.trigger_name IS NOT NULL THEN '⚠️ 缺少字段'
        ELSE '❌ 需要添加'
    END AS "状态"
FROM pg_tables t
LEFT JOIN information_schema.columns c ON (
    c.table_schema = t.schemaname 
    AND c.table_name = t.tablename 
    AND c.column_name = 'updated_at'
)
LEFT JOIN information_schema.triggers tr ON (
    tr.trigger_schema = t.schemaname 
    AND tr.event_object_table = t.tablename 
    AND tr.trigger_name LIKE '%updated_at%'
)
WHERE t.schemaname = 'public'
ORDER BY 
    CASE 
        WHEN c.column_name IS NOT NULL AND tr.trigger_name IS NOT NULL THEN 1
        WHEN c.column_name IS NOT NULL AND tr.trigger_name IS NULL THEN 2
        WHEN c.column_name IS NULL AND tr.trigger_name IS NOT NULL THEN 3
        ELSE 4
    END,
    t.tablename;

-- 统计信息
SELECT 
    COUNT(*) AS "总表数",
    COUNT(CASE WHEN c.column_name IS NOT NULL THEN 1 END) AS "有updated_at字段的表数",
    COUNT(CASE WHEN tr.trigger_name IS NOT NULL THEN 1 END) AS "有updated_at触发器的表数",
    COUNT(CASE WHEN c.column_name IS NOT NULL AND tr.trigger_name IS NOT NULL THEN 1 END) AS "完整配置的表数"
FROM pg_tables t
LEFT JOIN information_schema.columns c ON (
    c.table_schema = t.schemaname 
    AND c.table_name = t.tablename 
    AND c.column_name = 'updated_at'
)
LEFT JOIN information_schema.triggers tr ON (
    tr.trigger_schema = t.schemaname 
    AND tr.event_object_table = t.tablename 
    AND tr.trigger_name LIKE '%updated_at%'
)
WHERE t.schemaname = 'public';
