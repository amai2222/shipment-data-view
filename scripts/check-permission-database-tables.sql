-- 权限系统数据库表结构检查
-- 检查所有权限控制相关的数据库表

-- 1. 检查核心权限表
SELECT 
    'user_permissions' as table_name,
    '用户权限表' as description,
    '存储用户级别的权限配置，包括菜单、功能、项目、数据权限' as purpose
UNION ALL
SELECT 
    'role_permission_templates' as table_name,
    '角色权限模板表' as description,
    '存储角色默认权限配置，定义每个角色的基础权限' as purpose
UNION ALL
SELECT 
    'user_projects' as table_name,
    '用户项目关联表' as description,
    '存储用户与项目的关联关系，用于项目级权限控制' as purpose
UNION ALL
SELECT 
    'permission_audit_logs' as table_name,
    '权限审计日志表' as description,
    '记录所有权限变更操作，用于审计和追踪' as purpose
UNION ALL
SELECT 
    'contract_permissions' as table_name,
    '合同权限表' as description,
    '存储合同级别的权限配置，控制合同访问权限' as purpose
UNION ALL
SELECT 
    'contract_access_logs' as table_name,
    '合同访问日志表' as description,
    '记录合同访问操作，用于审计' as purpose;

-- 2. 检查 user_permissions 表结构
SELECT 
    'user_permissions' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'menu_permissions' THEN '菜单权限数组，控制可见菜单'
        WHEN column_name = 'function_permissions' THEN '功能权限数组，控制功能操作'
        WHEN column_name = 'project_permissions' THEN '项目权限数组，控制项目访问'
        WHEN column_name = 'data_permissions' THEN '数据权限数组，控制数据范围'
        WHEN column_name = 'inherit_role' THEN '是否继承角色权限'
        WHEN column_name = 'custom_settings' THEN '自定义设置，JSON格式'
        ELSE '其他字段'
    END as description
FROM information_schema.columns 
WHERE table_name = 'user_permissions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查 role_permission_templates 表结构
SELECT 
    'role_permission_templates' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'role' THEN '角色类型：admin, finance, business, operator, partner, viewer'
        WHEN column_name = 'menu_permissions' THEN '角色默认菜单权限'
        WHEN column_name = 'function_permissions' THEN '角色默认功能权限'
        WHEN column_name = 'project_permissions' THEN '角色默认项目权限'
        WHEN column_name = 'data_permissions' THEN '角色默认数据权限'
        WHEN column_name = 'is_system' THEN '是否为系统角色'
        WHEN column_name = 'name' THEN '角色显示名称'
        WHEN column_name = 'description' THEN '角色描述'
        WHEN column_name = 'color' THEN '角色颜色标识'
        ELSE '其他字段'
    END as description
FROM information_schema.columns 
WHERE table_name = 'role_permission_templates' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 检查权限数据存储情况
SELECT 
    '权限数据统计' as category,
    'user_permissions' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as user_count,
    COUNT(DISTINCT project_id) as project_count
FROM public.user_permissions
UNION ALL
SELECT 
    '权限数据统计' as category,
    'role_permission_templates' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT role) as role_count,
    0 as project_count
FROM public.role_permission_templates
UNION ALL
SELECT 
    '权限数据统计' as category,
    'permission_audit_logs' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as user_count,
    COUNT(DISTINCT target_project_id) as project_count
FROM public.permission_audit_logs;

-- 5. 检查菜单权限配置
SELECT 
    '菜单权限配置' as category,
    role,
    name,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates
ORDER BY role;

-- 6. 检查用户权限记录
SELECT 
    '用户权限记录' as category,
    u.full_name,
    u.role,
    up.menu_permissions,
    up.function_permissions,
    up.project_permissions,
    up.data_permissions,
    up.created_at
FROM public.user_permissions up
JOIN public.profiles u ON up.user_id = u.id
ORDER BY up.created_at DESC
LIMIT 10;

-- 7. 检查权限审计日志
SELECT 
    '权限审计日志' as category,
    u.full_name,
    pal.action,
    pal.permission_type,
    pal.permission_key,
    pal.reason,
    pal.created_at
FROM public.permission_audit_logs pal
JOIN public.profiles u ON pal.user_id = u.id
ORDER BY pal.created_at DESC
LIMIT 10;

-- 8. 检查权限表索引
SELECT 
    '权限表索引' as category,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('user_permissions', 'role_permission_templates', 'permission_audit_logs', 'user_projects')
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 9. 检查RLS策略
SELECT 
    'RLS策略' as category,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('user_permissions', 'role_permission_templates', 'permission_audit_logs', 'user_projects')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
