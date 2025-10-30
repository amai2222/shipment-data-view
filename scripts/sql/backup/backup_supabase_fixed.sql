-- 修复后的Supabase数据库结构备份查询
-- 可以直接在Supabase SQL编辑器中运行

-- 1. 查看所有表结构
SELECT 
    '-- 表: ' || t.table_schema || '.' || t.table_name || E'\n' ||
    'CREATE TABLE IF NOT EXISTS ' || t.table_schema || '.' || t.table_name || ' (' || E'\n' ||
    string_agg(
        '    ' || c.column_name || ' ' || 
        CASE 
            WHEN c.data_type = 'character varying' THEN 'varchar(' || c.character_maximum_length || ')'
            WHEN c.data_type = 'character' THEN 'char(' || c.character_maximum_length || ')'
            WHEN c.data_type = 'numeric' THEN 'numeric(' || c.numeric_precision || ',' || c.numeric_scale || ')'
            ELSE c.data_type
        END ||
        CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
        ',' || E'\n'
    ) || E'\n' || ');' || E'\n'
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public' 
AND t.table_type = 'BASE TABLE'
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_name;

-- 2. 查看所有函数定义
SELECT 
    '-- 函数: ' || n.nspname || '.' || p.proname || E'\n' ||
    pg_get_functiondef(p.oid) || ';' || E'\n'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 3. 查看所有视图定义
SELECT 
    '-- 视图: ' || schemaname || '.' || viewname || E'\n' ||
    'CREATE OR REPLACE VIEW ' || schemaname || '.' || viewname || ' AS ' || E'\n' ||
    definition || ';' || E'\n'
FROM pg_views 
WHERE schemaname = 'public' 
ORDER BY viewname;

-- 4. 查看所有触发器
SELECT 
    '-- 触发器: ' || t.tgname || ' ON ' || c.relname || E'\n' ||
    pg_get_triggerdef(t.oid) || ';' || E'\n'
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 5. 查看所有RLS策略
SELECT 
    '-- RLS策略: ' || policyname || ' ON ' || tablename || E'\n' ||
    'CREATE POLICY ' || policyname || ' ON ' || schemaname || '.' || tablename || E'\n' ||
    'FOR ' || cmd || E'\n' ||
    'TO ' || array_to_string(roles, ', ') || E'\n' ||
    CASE WHEN qual IS NOT NULL THEN 'USING (' || qual || ')' ELSE '' END || E'\n' ||
    CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK (' || with_check || ')' ELSE '' END || ';' || E'\n'
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 6. 查看所有索引
SELECT 
    '-- 索引: ' || indexname || ' ON ' || tablename || E'\n' ||
    indexdef || ';' || E'\n'
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- 7. 查看所有序列
SELECT 
    '-- 序列: ' || sequencename || E'\n' ||
    'CREATE SEQUENCE IF NOT EXISTS ' || schemaname || '.' || sequencename || E'\n' ||
    'START WITH ' || start_value || E'\n' ||
    'INCREMENT BY ' || increment_by || E'\n' ||
    'MINVALUE ' || min_value || E'\n' ||
    'MAXVALUE ' || max_value || E'\n' ||
    'NO CYCLE;' || E'\n'
FROM pg_sequences 
WHERE schemaname = 'public' 
ORDER BY sequencename;

-- 8. 查看所有外键约束
SELECT 
    '-- 外键约束: ' || tc.constraint_name || ' ON ' || tc.table_name || E'\n' ||
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name || E'\n' ||
    'ADD CONSTRAINT ' || tc.constraint_name || E'\n' ||
    'FOREIGN KEY (' || kcu.column_name || ')' || E'\n' ||
    'REFERENCES ' || ccu.table_schema || '.' || ccu.table_name || '(' || ccu.column_name || ');' || E'\n'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- 9. 查看所有检查约束
SELECT 
    '-- 检查约束: ' || tc.constraint_name || ' ON ' || tc.table_name || E'\n' ||
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name || E'\n' ||
    'ADD CONSTRAINT ' || tc.constraint_name || E'\n' ||
    'CHECK (' || cc.check_clause || ');' || E'\n'
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- 10. 查看所有自定义类型
SELECT 
    '-- 自定义类型: ' || t.typname || E'\n' ||
    'CREATE TYPE ' || n.nspname || '.' || t.typname || ' AS ' || 
    CASE 
        WHEN t.typtype = 'e' THEN 'ENUM (' || 
            (SELECT string_agg('''' || enumlabel || '''', ', ' ORDER BY enumsortorder)
             FROM pg_enum e WHERE e.enumtypid = t.oid) || ')'
        WHEN t.typtype = 'c' THEN 'COMPOSITE'
        WHEN t.typtype = 'd' THEN 'DOMAIN'
        ELSE 'UNKNOWN'
    END || ';' || E'\n'
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
AND t.typtype IN ('c', 'e', 'd')
ORDER BY t.typname;
