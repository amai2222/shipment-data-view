-- 检查用户 szf 的具体项目记录详情
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    pr.project_status,
    up.id as record_id,
    up.can_view,
    up.can_edit,
    up.can_delete,
    up.role,
    up.created_at,
    CASE 
        WHEN up.id IS NULL THEN '✅ 无记录 - 默认可访问'
        WHEN up.can_view = false THEN '❌ 限制记录 - 禁止访问'
        WHEN up.can_view = true THEN '⚠️ 分配记录 - 允许访问'
        ELSE '❓ 未知状态'
    END as record_status
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 10;
