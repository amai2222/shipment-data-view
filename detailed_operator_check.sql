-- 详细检查operator角色的权限数据
-- 1. 检查权限数组的详细内容
SELECT 
    role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions
FROM public.role_permission_templates
WHERE role = 'operator';

-- 2. 检查权限数量
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    array_length(menu_permissions, 1) + 
    array_length(function_permissions, 1) + 
    array_length(project_permissions, 1) + 
    array_length(data_permissions, 1) as total_count
FROM public.role_permission_templates
WHERE role = 'operator';

-- 3. 检查是否有权限被重复计算
SELECT 
    role,
    'menu' as permission_type,
    array_length(menu_permissions, 1) as count
FROM public.role_permission_templates
WHERE role = 'operator'
UNION ALL
SELECT 
    role,
    'function' as permission_type,
    array_length(function_permissions, 1) as count
FROM public.role_permission_templates
WHERE role = 'operator'
UNION ALL
SELECT 
    role,
    'project' as permission_type,
    array_length(project_permissions, 1) as count
FROM public.role_permission_templates
WHERE role = 'operator'
UNION ALL
SELECT 
    role,
    'data' as permission_type,
    array_length(data_permissions, 1) as count
FROM public.role_permission_templates
WHERE role = 'operator';
