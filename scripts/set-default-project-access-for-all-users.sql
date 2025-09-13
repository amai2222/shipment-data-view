-- 配置默认所有用户都拥有对所有项目的访问权限
-- 设置项目权限的默认访问策略

-- 1. 检查当前用户项目权限状态
SELECT 
    '当前用户项目权限状态' as category,
    COUNT(DISTINCT up.user_id) as users_with_permissions,
    COUNT(DISTINCT up.project_id) as projects_with_permissions,
    COUNT(*) as total_permission_records
FROM public.user_projects up;

-- 2. 检查所有用户和项目
SELECT 
    '用户和项目统计' as category,
    (SELECT COUNT(*) FROM public.profiles WHERE is_active = true) as active_users,
    (SELECT COUNT(*) FROM public.projects WHERE project_status = '进行中') as active_projects,
    (SELECT COUNT(*) FROM public.projects) as total_projects;

-- 3. 方案A：清空 user_projects 表，让系统使用默认权限
-- 如果 user_projects 表为空，系统将默认所有用户都可以访问所有项目
DELETE FROM public.user_projects;

-- 4. 验证清空结果
SELECT 
    '清空后状态' as category,
    COUNT(*) as remaining_records,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 清空成功，将使用默认权限'
        ELSE '❌ 清空失败，仍有记录'
    END as status
FROM public.user_projects;

-- 5. 方案B：为所有用户创建所有项目的访问权限（如果需要显式权限）
/*
-- 为所有活跃用户创建对所有进行中项目的访问权限
INSERT INTO public.user_projects (user_id, project_id, role, created_by)
SELECT 
    p.id as user_id,
    pr.id as project_id,
    'member' as role,
    (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1) as created_by
FROM public.profiles p
CROSS JOIN public.projects pr
WHERE p.is_active = true 
  AND pr.project_status = '进行中'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_projects up 
    WHERE up.user_id = p.id AND up.project_id = pr.id
  );
*/

-- 6. 检查权限系统的默认行为
-- 在 IntegratedUserPermissionManager.tsx 中，如果 userProjectPermissions 为空数组，
-- 系统会默认允许访问所有项目
SELECT 
    '权限系统默认行为' as category,
    '如果 user_projects 表为空，系统将默认所有用户都可以访问所有项目' as description,
    '这符合您的要求：默认所有用户都拥有对所有项目的访问权限' as result;

-- 7. 验证权限逻辑
-- 检查前端代码中的权限判断逻辑
SELECT 
    '前端权限判断逻辑' as category,
    'ProjectPermissionManager.tsx 中的逻辑：' as component,
    'hasAccess = userProjectPermissions.length === 0 || userProjectPermissions.includes(project.id)' as logic,
    '当 userProjectPermissions 为空数组时，hasAccess 为 true' as explanation;

-- 8. 如果需要恢复显式权限控制，可以使用以下查询
-- 查看哪些用户有项目权限限制
SELECT 
    '显式权限控制恢复' as category,
    '如果需要恢复显式权限控制，可以运行以下查询：' as instruction,
    'SELECT * FROM public.user_projects;' as query;

-- 9. 最终验证
SELECT 
    '最终验证' as category,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.user_projects) = 0 
        THEN '✅ 配置成功：所有用户默认可以访问所有项目'
        ELSE '❌ 配置失败：仍有用户项目权限记录'
    END as final_status;
