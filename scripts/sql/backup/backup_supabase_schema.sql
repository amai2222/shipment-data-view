-- Supabase数据库完整结构备份脚本
-- 用于备份表定义、函数、触发器、视图、RLS等

-- 1. 备份所有表结构
\copy (SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename) TO 'tables_backup.csv' WITH CSV HEADER;

-- 2. 备份所有视图定义
\copy (SELECT 
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
ORDER BY viewname) TO 'views_backup.csv' WITH CSV HEADER;

-- 3. 备份所有函数定义
\copy (SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname) TO 'functions_backup.csv' WITH CSV HEADER;

-- 4. 备份所有触发器
\copy (SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    t.tgenabled as enabled,
    pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname) TO 'triggers_backup.csv' WITH CSV HEADER;

-- 5. 备份所有索引
\copy (SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname) TO 'indexes_backup.csv' WITH CSV HEADER;

-- 6. 备份所有RLS策略
\copy (SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname) TO 'rls_policies_backup.csv' WITH CSV HEADER;

-- 7. 备份所有序列
\copy (SELECT 
    schemaname,
    sequencename,
    start_value,
    minimum_value,
    maximum_value,
    increment,
    cycle_option
FROM pg_sequences 
WHERE schemaname = 'public' 
ORDER BY sequencename) TO 'sequences_backup.csv' WITH CSV HEADER;

-- 8. 备份所有约束
\copy (SELECT 
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name) TO 'constraints_backup.csv' WITH CSV HEADER;

-- 9. 生成完整的DDL脚本
\copy (SELECT 
    'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
    string_agg(
        column_name || ' ' || data_type || 
        CASE WHEN character_maximum_length IS NOT NULL 
             THEN '(' || character_maximum_length || ')' 
             ELSE '' END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        ', '
    ) || ');' as ddl
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE t.table_schema = 'public' 
AND t.table_type = 'BASE TABLE'
GROUP BY schemaname, tablename
ORDER BY tablename) TO 'table_ddl_backup.sql' WITH CSV HEADER;

-- 10. 备份所有自定义类型
\copy (SELECT 
    n.nspname as schema_name,
    t.typname as type_name,
    t.typtype as type_type,
    pg_get_type_string(t.oid) as type_definition
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
AND t.typtype IN ('c', 'e', 'd')  -- composite, enum, domain
ORDER BY t.typname) TO 'types_backup.csv' WITH CSV HEADER;
