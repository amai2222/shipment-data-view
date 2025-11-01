-- ============================================================================
-- 检查系统管理员和操作员角色的菜单权限差异
-- ============================================================================

-- 1. 查看管理员角色的菜单权限
SELECT 
    'admin' as role,
    menu_permissions,
    array_length(menu_permissions, 1) as menu_count
FROM public.role_permission_templates
WHERE role = 'admin';

-- 2. 查看操作员角色的菜单权限
SELECT 
    'operator' as role,
    menu_permissions,
    array_length(menu_permissions, 1) as menu_count
FROM public.role_permission_templates
WHERE role = 'operator';

-- 3. 找出管理员有但操作员没有的菜单权限
WITH admin_perms AS (
    SELECT unnest(menu_permissions) as menu_key
    FROM public.role_permission_templates
    WHERE role = 'admin'
),
operator_perms AS (
    SELECT unnest(menu_permissions) as menu_key
    FROM public.role_permission_templates
    WHERE role = 'operator'
)
SELECT 
    admin_perms.menu_key as missing_in_operator,
    CASE 
        WHEN admin_perms.menu_key LIKE 'settings%' THEN '设置菜单'
        WHEN admin_perms.menu_key LIKE 'dashboard.project' THEN '项目看板'
        WHEN admin_perms.menu_key LIKE 'maintenance.projects' THEN '项目管理'
        WHEN admin_perms.menu_key LIKE 'maintenance.locations_enhanced' THEN '地点管理增强版'
        ELSE '其他'
    END as category
FROM admin_perms
WHERE NOT EXISTS (
    SELECT 1 FROM operator_perms 
    WHERE operator_perms.menu_key = admin_perms.menu_key
)
ORDER BY category, missing_in_operator;

-- 4. 统计差异数量
WITH admin_perms AS (
    SELECT unnest(menu_permissions) as menu_key
    FROM public.role_permission_templates
    WHERE role = 'admin'
),
operator_perms AS (
    SELECT unnest(menu_permissions) as menu_key
    FROM public.role_permission_templates
    WHERE role = 'operator'
)
SELECT 
    COUNT(DISTINCT admin_perms.menu_key) as admin_total,
    COUNT(DISTINCT operator_perms.menu_key) as operator_total,
    COUNT(DISTINCT admin_perms.menu_key) - COUNT(DISTINCT operator_perms.menu_key) as difference,
    COUNT(CASE WHEN admin_perms.menu_key NOT IN (SELECT menu_key FROM operator_perms) THEN 1 END) as missing_in_operator
FROM admin_perms
CROSS JOIN operator_perms;

-- 5. 列出所有菜单权限（用于对比）
SELECT 
    role,
    array_to_string(menu_permissions, ', ') as all_menu_permissions
FROM public.role_permission_templates
WHERE role IN ('admin', 'operator')
ORDER BY role;

