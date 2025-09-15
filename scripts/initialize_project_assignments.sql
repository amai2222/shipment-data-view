-- 初始化项目分配权限
-- 确保所有用户都有所有项目的默认访问权限

-- 1. 检查当前项目分配状态
SELECT '检查当前项目分配状态' as step;

SELECT 
    '用户数量' as info,
    COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
    '项目数量' as info,
    COUNT(*) as count
FROM public.projects
UNION ALL
SELECT 
    '项目分配记录数' as info,
    COUNT(*) as count
FROM public.user_projects;

-- 2. 为所有用户分配所有项目（默认权限）
SELECT '为所有用户分配所有项目' as step;

INSERT INTO public.user_projects (
    user_id,
    project_id,
    role,
    can_view,
    can_edit,
    can_delete,
    created_at,
    updated_at,
    created_by
)
SELECT 
    p.id as user_id,
    pr.id as project_id,
    'operator'::app_role as role,
    true as can_view,
    true as can_edit,
    false as can_delete,
    NOW() as created_at,
    NOW() as updated_at,
    (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1) as created_by
FROM public.profiles p
CROSS JOIN public.projects pr
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_projects up 
    WHERE up.user_id = p.id 
    AND up.project_id = pr.id
)
ON CONFLICT (user_id, project_id) DO NOTHING;

-- 3. 验证分配结果
SELECT '验证分配结果' as step;

SELECT 
    '总分配记录数' as info,
    COUNT(*) as count
FROM public.user_projects
UNION ALL
SELECT 
    '用户项目组合数' as info,
    COUNT(DISTINCT user_id || '-' || project_id) as count
FROM public.user_projects
UNION ALL
SELECT 
    '预期组合数' as info,
    (SELECT COUNT(*) FROM public.profiles) * (SELECT COUNT(*) FROM public.projects) as count;

-- 4. 显示分配统计
SELECT '分配统计' as step;

SELECT 
    p.full_name as user_name,
    p.role as user_role,
    COUNT(up.project_id) as assigned_projects,
    COUNT(pr.id) as total_projects
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
LEFT JOIN public.projects pr ON up.project_id = pr.id
GROUP BY p.id, p.full_name, p.role
ORDER BY p.full_name;
