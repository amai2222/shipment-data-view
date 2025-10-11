-- 检查用户项目权限设置详情
-- 查看用户 szf 的项目权限配置

SELECT 
    p.full_name as user_name,
    p.email,
    p.role as user_role,
    pr.name as project_name,
    pr.project_status,
    up.role as project_role,
    up.can_view,
    up.can_edit,
    up.can_delete,
    up.created_at as assignment_created_at
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
LEFT JOIN public.projects pr ON up.project_id = pr.id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 10;

-- 检查是否有权限被明确限制的用户
SELECT 
    p.full_name as user_name,
    COUNT(*) as total_assignments,
    COUNT(CASE WHEN up.can_view = false THEN 1 END) as restricted_view,
    COUNT(CASE WHEN up.can_edit = false THEN 1 END) as restricted_edit,
    COUNT(CASE WHEN up.can_delete = false THEN 1 END) as restricted_delete
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
GROUP BY p.id, p.full_name
ORDER BY restricted_view DESC, restricted_edit DESC;

-- 检查所有用户的权限设置模式
SELECT 
    '权限设置模式' as info,
    COUNT(*) as count
FROM public.user_projects
WHERE can_view = true AND can_edit = true AND can_delete = false
UNION ALL
SELECT 
    '限制查看权限' as info,
    COUNT(*) as count
FROM public.user_projects
WHERE can_view = false
UNION ALL
SELECT 
    '限制编辑权限' as info,
    COUNT(*) as count
FROM public.user_projects
WHERE can_edit = false
UNION ALL
SELECT 
    '限制删除权限' as info,
    COUNT(*) as count
FROM public.user_projects
WHERE can_delete = false;
