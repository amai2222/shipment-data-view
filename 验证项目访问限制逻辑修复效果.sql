-- 验证项目访问限制逻辑修复效果
-- 检查用户项目访问限制状态

-- 1. 检查所有用户的项目访问限制统计
SELECT 
    p.full_name as user_name,
    p.email,
    p.role as user_role,
    COUNT(up.id) as restricted_projects, -- 被限制的项目数
    (SELECT COUNT(*) FROM public.projects) as total_projects, -- 总项目数
    (SELECT COUNT(*) FROM public.projects) - COUNT(up.id) as accessible_projects -- 可访问的项目数
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
GROUP BY p.id, p.full_name, p.email, p.role
ORDER BY restricted_projects DESC, p.full_name;

-- 2. 检查用户 szf 的具体项目访问限制情况
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    pr.project_status,
    up.can_view,
    up.can_edit,
    up.can_delete,
    CASE 
        WHEN up.id IS NULL THEN '✅ 可访问（默认权限）'
        WHEN up.can_view = false THEN '❌ 被限制访问'
        ELSE '⚠️ 有访问限制记录'
    END as access_status
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 10;

-- 3. 检查访问限制模式统计
SELECT 
    '访问限制模式统计' as info,
    COUNT(*) as count
FROM public.user_projects
WHERE can_view = true AND can_edit = true AND can_delete = false
UNION ALL
SELECT 
    '完全限制访问' as info,
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

-- 4. 测试项目访问权限检查
-- 检查用户 szf 对特定项目的访问权限
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    CASE 
        WHEN up.id IS NULL THEN true -- 没有限制记录 = 可访问
        WHEN up.can_view = false THEN false -- 被限制访问
        ELSE true -- 其他情况 = 可访问
    END as has_access
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 5;

-- 5. 验证界面逻辑
-- 检查前端应该显示的状态
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    CASE 
        WHEN up.id IS NULL THEN 'isAssigned: true (可访问)'
        WHEN up.can_view = false THEN 'isAssigned: false (被限制)'
        ELSE 'isAssigned: false (有记录)'
    END as frontend_status
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 5;
