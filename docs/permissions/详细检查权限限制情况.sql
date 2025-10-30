-- 详细检查权限限制情况
-- 查看哪些用户和项目被限制了权限

-- 1. 检查被限制编辑权限的记录
SELECT 
    p.full_name as user_name,
    p.email,
    pr.name as project_name,
    pr.project_status,
    up.can_view,
    up.can_edit,
    up.can_delete,
    up.role as project_role
FROM public.profiles p
JOIN public.user_projects up ON p.id = up.user_id
JOIN public.projects pr ON up.project_id = pr.id
WHERE up.can_edit = false
ORDER BY p.full_name, pr.name
LIMIT 20;

-- 2. 检查被限制删除权限的记录
SELECT 
    p.full_name as user_name,
    p.email,
    pr.name as project_name,
    pr.project_status,
    up.can_view,
    up.can_edit,
    up.can_delete,
    up.role as project_role
FROM public.profiles p
JOIN public.user_projects up ON p.id = up.user_id
JOIN public.projects pr ON up.project_id = pr.id
WHERE up.can_delete = false
ORDER BY p.full_name, pr.name
LIMIT 20;

-- 3. 统计每个用户的权限限制情况
SELECT 
    p.full_name as user_name,
    p.email,
    p.role as user_role,
    COUNT(up.id) as total_assignments,
    COUNT(CASE WHEN up.can_view = false THEN 1 END) as restricted_view,
    COUNT(CASE WHEN up.can_edit = false THEN 1 END) as restricted_edit,
    COUNT(CASE WHEN up.can_delete = false THEN 1 END) as restricted_delete,
    COUNT(CASE WHEN up.can_view = true AND up.can_edit = true AND up.can_delete = false THEN 1 END) as normal_permissions
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
GROUP BY p.id, p.full_name, p.email, p.role
ORDER BY restricted_edit DESC, restricted_delete DESC;

-- 4. 检查是否有用户完全没有项目分配记录
SELECT 
    p.full_name as user_name,
    p.email,
    p.role as user_role,
    COUNT(up.id) as assignment_count
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
GROUP BY p.id, p.full_name, p.email, p.role
HAVING COUNT(up.id) = 0;
