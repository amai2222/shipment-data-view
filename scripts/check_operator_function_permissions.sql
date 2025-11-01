-- ============================================================================
-- 检查操作员和管理员的功能权限差异
-- ============================================================================

-- 1. 查看管理员的功能权限
SELECT 
    'admin' as role,
    function_permissions,
    array_length(function_permissions, 1) as function_count
FROM public.role_permission_templates
WHERE role = 'admin';

-- 2. 查看操作员的功能权限
SELECT 
    'operator' as role,
    function_permissions,
    array_length(function_permissions, 1) as function_count
FROM public.role_permission_templates
WHERE role = 'operator';

-- 3. 找出管理员有但操作员没有的功能权限
WITH admin_perms AS (
    SELECT unnest(function_permissions) as func_key
    FROM public.role_permission_templates
    WHERE role = 'admin'
),
operator_perms AS (
    SELECT unnest(function_permissions) as func_key
    FROM public.role_permission_templates
    WHERE role = 'operator'
)
SELECT 
    admin_perms.func_key as missing_in_operator,
    CASE 
        WHEN admin_perms.func_key LIKE 'system%' THEN '系统管理功能'
        WHEN admin_perms.func_key LIKE 'data.delete' THEN '数据删除功能'
        WHEN admin_perms.func_key LIKE 'data.import' THEN '数据导入功能'
        WHEN admin_perms.func_key LIKE 'finance.approve%' THEN '财务审批功能'
        ELSE '其他功能'
    END as category
FROM admin_perms
WHERE NOT EXISTS (
    SELECT 1 FROM operator_perms 
    WHERE operator_perms.func_key = admin_perms.func_key
)
ORDER BY category, missing_in_operator;

-- 4. 统计差异数量
WITH admin_perms AS (
    SELECT unnest(function_permissions) as func_key
    FROM public.role_permission_templates
    WHERE role = 'admin'
),
operator_perms AS (
    SELECT unnest(function_permissions) as func_key
    FROM public.role_permission_templates
    WHERE role = 'operator'
)
SELECT 
    COUNT(DISTINCT admin_perms.func_key) as admin_total,
    COUNT(DISTINCT operator_perms.func_key) as operator_total,
    COUNT(DISTINCT admin_perms.func_key) - COUNT(DISTINCT operator_perms.func_key) as difference,
    COUNT(CASE WHEN admin_perms.func_key LIKE 'system%' AND admin_perms.func_key NOT IN (SELECT func_key FROM operator_perms) THEN 1 END) as missing_system_functions
FROM admin_perms
CROSS JOIN operator_perms;

