-- 补充检查：验证所有权限表的 RLS 策略
-- 检查是否有遗漏的权限表或策略

-- 1. 检查所有权限相关表的 RLS 状态
SELECT 
    'RLS状态检查' as category,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ 已启用'
        ELSE '❌ 未启用'
    END as status
FROM pg_tables 
WHERE tablename IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'contract_permissions',
    'contract_access_logs'
)
AND schemaname = 'public'
ORDER BY tablename;

-- 2. 检查 user_projects 表的 RLS 策略（可能遗漏）
SELECT 
    'user_projects RLS策略' as category,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_projects'
  AND schemaname = 'public'
ORDER BY policyname;

-- 3. 检查 contract_permissions 表的 RLS 策略
SELECT 
    'contract_permissions RLS策略' as category,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'contract_permissions'
  AND schemaname = 'public'
ORDER BY policyname;

-- 4. 检查 contract_access_logs 表的 RLS 策略
SELECT 
    'contract_access_logs RLS策略' as category,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'contract_access_logs'
  AND schemaname = 'public'
ORDER BY policyname;

-- 5. 检查 is_admin() 函数是否存在
SELECT 
    'is_admin函数检查' as category,
    proname as function_name,
    prosrc as function_body,
    CASE 
        WHEN proname = 'is_admin' THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status
FROM pg_proc 
WHERE proname = 'is_admin'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 6. 检查所有权限表的索引
SELECT 
    '权限表索引检查' as category,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'contract_permissions',
    'contract_access_logs'
)
AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. 检查权限表的数据完整性
SELECT 
    '权限数据完整性检查' as category,
    'user_permissions' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT project_id) as unique_projects,
    COUNT(CASE WHEN menu_permissions IS NOT NULL AND array_length(menu_permissions, 1) > 0 THEN 1 END) as records_with_menu_permissions,
    COUNT(CASE WHEN function_permissions IS NOT NULL AND array_length(function_permissions, 1) > 0 THEN 1 END) as records_with_function_permissions,
    COUNT(CASE WHEN project_permissions IS NOT NULL AND array_length(project_permissions, 1) > 0 THEN 1 END) as records_with_project_permissions,
    COUNT(CASE WHEN data_permissions IS NOT NULL AND array_length(data_permissions, 1) > 0 THEN 1 END) as records_with_data_permissions
FROM public.user_permissions
UNION ALL
SELECT 
    '权限数据完整性检查' as category,
    'role_permission_templates' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT role) as unique_roles,
    0 as unique_projects,
    COUNT(CASE WHEN menu_permissions IS NOT NULL AND array_length(menu_permissions, 1) > 0 THEN 1 END) as records_with_menu_permissions,
    COUNT(CASE WHEN function_permissions IS NOT NULL AND array_length(function_permissions, 1) > 0 THEN 1 END) as records_with_function_permissions,
    COUNT(CASE WHEN project_permissions IS NOT NULL AND array_length(project_permissions, 1) > 0 THEN 1 END) as records_with_project_permissions,
    COUNT(CASE WHEN data_permissions IS NOT NULL AND array_length(data_permissions, 1) > 0 THEN 1 END) as records_with_data_permissions
FROM public.role_permission_templates;

-- 8. 检查权限表的外键约束
SELECT 
    '权限表外键检查' as category,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'user_projects',
    'contract_permissions',
    'contract_access_logs'
  )
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;
