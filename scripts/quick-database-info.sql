-- 快速获取数据库关键信息的SQL命令
-- 请在Supabase SQL编辑器中执行

-- 1. 获取所有表名和基本信息
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
    pg_get_function_identity_arguments(oid) as arguments,
    pg_get_function_result(oid) as return_type,
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
