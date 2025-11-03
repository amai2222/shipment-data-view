-- ============================================================================
-- 诊断开票申请权限问题
-- ============================================================================
-- 目标：检查为什么新建的管理员没有开票申请权限
-- ============================================================================

-- 第一步：检查 is_finance_or_admin 函数的定义
\echo '=========================================='
\echo '1. 检查 is_finance_or_admin 函数定义'
\echo '=========================================='
SELECT 
    proname AS function_name,
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'is_finance_or_admin'
  AND pronamespace = 'public'::regnamespace;

-- 第二步：检查 has_role 函数的定义
\echo ''
\echo '=========================================='
\echo '2. 检查 has_role 函数定义'
\echo '=========================================='
SELECT 
    proname AS function_name,
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'has_role'
  AND pronamespace = 'public'::regnamespace;

-- 第三步：检查所有管理员用户的信息
\echo ''
\echo '=========================================='
\echo '3. 检查所有管理员用户'
\echo '=========================================='
SELECT 
    id,
    email,
    username,
    role,
    created_at
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at;

-- 第四步：检查 role_permission_templates 表中 admin 角色的权限
\echo ''
\echo '=========================================='
\echo '4. 检查 admin 角色模板权限'
\echo '=========================================='
SELECT 
    role,
    name,
    description,
    is_system,
    is_active,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions
FROM public.role_permission_templates
WHERE role = 'admin';

-- 第五步：检查所有管理员的用户自定义权限
\echo ''
\echo '=========================================='
\echo '5. 检查管理员用户的自定义权限'
\echo '=========================================='
SELECT 
    p.id,
    p.email,
    p.username,
    p.role,
    up.id as permission_id,
    up.project_id,
    up.menu_permissions,
    up.function_permissions,
    up.project_permissions,
    up.data_permissions,
    up.created_at as permission_created_at
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id
WHERE p.role = 'admin'
ORDER BY p.created_at, up.project_id;

-- 第六步：测试每个管理员调用 is_finance_or_admin 函数的结果
\echo ''
\echo '=========================================='
\echo '6. 测试每个管理员的权限检查函数'
\echo '=========================================='
-- 注意：这个查询需要通过设置会话上下文来模拟不同用户
-- 但在SQL中无法直接模拟，我们只能检查函数逻辑

-- 第七步：检查开票申请相关的RPC函数权限要求
\echo ''
\echo '=========================================='
\echo '7. 检查 save_invoice_request 函数的权限检查'
\echo '=========================================='
SELECT 
    proname AS function_name,
    prosrc AS function_source
FROM pg_proc
WHERE proname = 'save_invoice_request'
  AND pronamespace = 'public'::regnamespace;

-- 第八步：直接检查 app_role 枚举类型
\echo ''
\echo '=========================================='
\echo '8. 检查 app_role 枚举类型'
\echo '=========================================='
SELECT 
    t.typname,
    e.enumlabel,
    e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'app_role'
ORDER BY e.enumsortorder;

-- 第九步：检查 profiles 表的 role 字段类型
\echo ''
\echo '=========================================='
\echo '9. 检查 profiles 表的 role 字段定义'
\echo '=========================================='
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'role';

-- 第十步：列出所有与开票申请相关的函数
\echo ''
\echo '=========================================='
\echo '10. 列出所有开票申请相关的函数'
\echo '=========================================='
SELECT 
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments,
    CASE 
        WHEN prosrc LIKE '%is_finance_or_admin%' THEN '使用 is_finance_or_admin'
        WHEN prosrc LIKE '%is_finance_or_admin_for_invoice%' THEN '使用 is_finance_or_admin_for_invoice'
        ELSE '未使用权限检查'
    END AS permission_check
FROM pg_proc
WHERE (
    proname LIKE '%invoice%request%'
    OR proname LIKE '%save_invoice%'
    OR proname LIKE '%approve_invoice%'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

\echo ''
\echo '=========================================='
\echo '诊断完成'
\echo '=========================================='

