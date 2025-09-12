-- 修复后的数据库结构查询命令
-- 请在Supabase SQL编辑器中执行

-- 1. 获取所有对象概览（修复了oid引用问题）
SELECT 
    'TABLE' as object_type,
    tablename as object_name,
    '' as details
FROM pg_tables 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'FUNCTION' as object_type,
    proname as object_name,
    pg_get_function_identity_arguments(p.oid) as details
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
UNION ALL
SELECT 
    'VIEW' as object_type,
    viewname as object_name,
    '' as details
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY object_type, object_name;

-- 2. 获取关键表的字段信息
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PK'
        WHEN fk.column_name IS NOT NULL THEN 'FK'
        ELSE ''
    END as key_type,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'profiles', 'projects', 'drivers', 'locations', 'partners', 
        'partner_chains', 'logistics_records', 'scale_records',
        'billing_types', 'payment_requests', 'contracts',
        'import_templates', 'import_field_mappings', 'import_fixed_mappings'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 3. 获取所有自定义函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    l.lanname as language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'  -- 只获取函数，不包括过程
ORDER BY proname;

-- 4. 获取RLS策略信息
SELECT 
    tablename,
    policyname,
    cmd as command,
    roles,
    qual as condition
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. 获取所有表的基本信息
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 6. 获取所有约束信息
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
