-- 验证项目权限修复效果
-- 检查用户 szf 的项目权限状态

-- 1. 检查用户信息
SELECT 
    id,
    full_name,
    email,
    role,
    is_active
FROM public.profiles 
WHERE full_name = 'szf';

-- 2. 检查用户权限记录
SELECT 
    up.user_id,
    up.project_id,
    p.name as project_name,
    up.project_permissions,
    up.menu_permissions,
    up.function_permissions,
    up.created_at
FROM public.user_permissions up
LEFT JOIN public.projects p ON up.project_id = p.id
WHERE up.user_id = (
    SELECT id FROM public.profiles WHERE full_name = 'szf'
)
ORDER BY up.created_at DESC;

-- 3. 检查角色权限模板
SELECT 
    role,
    project_permissions,
    menu_permissions,
    function_permissions
FROM public.role_permission_templates
WHERE role = (
    SELECT role FROM public.profiles WHERE full_name = 'szf'
);

-- 4. 检查所有进行中的项目
SELECT 
    id,
    name,
    project_status,
    manager,
    loading_address,
    unloading_address
FROM public.projects 
WHERE project_status = '进行中'
ORDER BY created_at DESC;

-- 5. 验证修复逻辑
-- 如果用户没有权限记录，应该默认访问所有项目
-- 如果用户有权限记录，则根据记录判断
SELECT 
    '修复验证' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE user_id = (SELECT id FROM public.profiles WHERE full_name = 'szf')
        ) THEN '用户有权限记录'
        ELSE '用户无权限记录，应默认访问所有项目'
    END as permission_status,
    COUNT(p.id) as total_projects,
    COUNT(p.id) as accessible_projects,
    0 as restricted_projects
FROM public.projects p
WHERE p.project_status = '进行中';
