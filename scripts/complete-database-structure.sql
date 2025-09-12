-- 获取完整数据库结构的SQL查询
-- 请逐个执行这些查询以避免超时

-- 1. 获取所有表名（完整列表）
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 获取所有表的列信息（分批查询，避免超时）
-- 第一批：基础表
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'profiles', 'projects', 'drivers', 'locations', 'partners',
        'billing_types', 'partner_chains'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 3. 第二批：运单相关表
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'logistics_records', 'logistics_partner_costs', 'scale_records'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 4. 第三批：财务相关表
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'payment_requests', 'partner_payment_requests', 'payment_records',
        'invoice_records', 'partner_bank_details'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 5. 第四批：合同相关表
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'contracts', 'contract_tags', 'contract_tag_relations',
        'contract_permissions', 'contract_reminders', 'contract_numbering_rules',
        'contract_file_versions', 'contract_access_logs'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 6. 第五批：权限和审计表
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'user_roles', 'user_permissions', 'role_permission_templates',
        'permission_audit_logs', 'saved_searches'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 7. 第六批：导入模板和其他表
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'import_templates', 'import_field_mappings', 'import_fixed_mappings',
        'external_platforms', 'partner_payment_items'
    )
ORDER BY t.table_name, c.ordinal_position;

-- 8. 获取所有主键信息
SELECT 
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name;

-- 9. 获取所有外键信息
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- 10. 获取所有函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- 11. 获取所有视图
SELECT viewname, definition
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;
