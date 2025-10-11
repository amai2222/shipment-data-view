-- 验证修复后的项目访问限制逻辑
-- 检查用户 szf 的修复后状态

-- 1. 检查用户 szf 的项目访问状态（修复后）
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    pr.project_status,
    up.can_view,
    up.can_edit,
    up.can_delete,
    up.role,
    CASE 
        WHEN up.id IS NULL THEN '✅ 无记录 - 默认可访问'
        WHEN up.can_view = true THEN '✅ 有记录且可访问'
        WHEN up.can_view = false THEN '❌ 有记录但被限制'
        ELSE '❓ 未知状态'
    END as access_status,
    CASE 
        WHEN up.id IS NULL THEN 'isAssigned: true (可访问)'
        WHEN up.can_view = true THEN 'isAssigned: true (可访问)'
        WHEN up.can_view = false THEN 'isAssigned: false (被限制)'
        ELSE 'isAssigned: ? (未知)'
    END as frontend_status
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 10;

-- 2. 统计用户 szf 的项目访问情况
SELECT 
    p.full_name as user_name,
    COUNT(pr.id) as total_projects,
    COUNT(CASE WHEN up.id IS NULL THEN 1 END) as no_record_projects,
    COUNT(CASE WHEN up.can_view = true THEN 1 END) as accessible_projects,
    COUNT(CASE WHEN up.can_view = false THEN 1 END) as restricted_projects,
    COUNT(CASE WHEN up.id IS NULL OR up.can_view = true THEN 1 END) as total_accessible
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
GROUP BY p.id, p.full_name;

-- 3. 测试项目访问权限检查函数逻辑
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    up.can_view,
    CASE 
        WHEN up.id IS NULL THEN true -- 无记录 = 有访问权限
        WHEN up.can_view = true THEN true -- 有记录且can_view=true = 有访问权限
        WHEN up.can_view = false THEN false -- 有记录且can_view=false = 无访问权限
        ELSE true -- 默认有访问权限
    END as has_access
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 10;
