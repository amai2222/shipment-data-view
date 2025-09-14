-- 检查admin角色的实际数据
SELECT 
    role,
    name,
    description,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions,
    is_system,
    color,
    created_at,
    updated_at
FROM public.role_permission_templates 
WHERE role = 'admin';
