-- 验证移动端项目访问限制逻辑修复效果
-- 检查移动端和桌面端逻辑一致性

-- 1. 检查用户项目记录（修复后应该使用can_view标志）
SELECT 
    p.full_name as user_name,
    pr.name as project_name,
    up.can_view,
    up.can_edit,
    up.can_delete,
    up.role,
    up.created_at,
    CASE 
        WHEN up.id IS NULL THEN '✅ 无记录 - 默认可访问'
        WHEN up.can_view = true THEN '✅ 有记录且可访问'
        WHEN up.can_view = false THEN '❌ 有记录但被限制'
        ELSE '❓ 未知状态'
    END as access_status
FROM public.profiles p
CROSS JOIN public.projects pr
LEFT JOIN public.user_projects up ON p.id = up.user_id AND pr.id = up.project_id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%'
ORDER BY pr.name
LIMIT 10;

-- 2. 检查移动端逻辑一致性
-- 移动端应该只存储can_view=false的记录（被限制的项目）
SELECT 
    '移动端逻辑验证' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN can_view = true THEN 1 END) as accessible_records,
    COUNT(CASE WHEN can_view = false THEN 1 END) as restricted_records,
    COUNT(CASE WHEN role = 'restricted' THEN 1 END) as old_restricted_role_records
FROM public.user_projects up
JOIN public.profiles p ON up.user_id = p.id
WHERE p.full_name = 'szf' OR p.email LIKE '%szf%';

-- 3. 验证移动端和桌面端数据一致性
-- 两个端应该使用相同的数据结构和逻辑
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

-- 4. 检查是否有旧的restricted角色记录需要清理
SELECT 
    '需要清理的旧记录' as info,
    COUNT(*) as count
FROM public.user_projects
WHERE role = 'restricted';

-- 5. 建议的清理SQL（如果需要）
-- DELETE FROM public.user_projects WHERE role = 'restricted';
