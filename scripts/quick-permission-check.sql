-- 日常权限检查脚本
-- 快速检查权限系统状态和继承逻辑

-- 1. 快速权限状态检查
SELECT 
    '=== 权限系统快速检查 ===' as section,
    '检查时间: ' || now() as check_time;

-- 2. 角色权限模板状态
SELECT 
    '角色权限模板' as category,
    role,
    name,
    COALESCE(array_length(menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(function_permissions, 1), 0) as function_count,
    COALESCE(array_length(project_permissions, 1), 0) as project_count,
    COALESCE(array_length(data_permissions, 1), 0) as data_count
FROM public.role_permission_templates 
ORDER BY role;

-- 3. 用户权限继承状态
SELECT 
    '用户权限继承状态' as category,
    u.role,
    COUNT(*) as total_users,
    COUNT(CASE WHEN up.user_id IS NULL THEN 1 END) as use_role_template,
    COUNT(CASE WHEN up.inherit_role = true THEN 1 END) as inherit_role,
    COUNT(CASE WHEN up.inherit_role = false THEN 1 END) as custom_permissions
FROM public.users u
LEFT JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
GROUP BY u.role
ORDER BY u.role;

-- 4. 权限继承问题检查
SELECT 
    '权限继承问题检查' as category,
    u.email,
    u.role,
    CASE 
        WHEN up.user_id IS NOT NULL AND up.inherit_role = false THEN '❌ 不继承角色权限'
        WHEN up.user_id IS NOT NULL AND up.inherit_role = true THEN '⚠️ 继承角色权限但有用户特定权限'
        WHEN up.user_id IS NULL THEN '✅ 使用角色模板权限'
        ELSE '❓ 状态未知'
    END as status
FROM public.users u
LEFT JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
WHERE up.user_id IS NOT NULL AND up.inherit_role = false
ORDER BY u.role, u.email;

-- 5. 权限统计摘要
SELECT 
    '权限统计摘要' as category,
    '总用户数' as metric,
    COUNT(*) as value
FROM public.users

UNION ALL

SELECT 
    '权限统计摘要' as category,
    '使用角色模板权限的用户' as metric,
    COUNT(*) as value
FROM public.users u
LEFT JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
WHERE up.user_id IS NULL

UNION ALL

SELECT 
    '权限统计摘要' as category,
    '有用户特定权限的用户' as metric,
    COUNT(*) as value
FROM public.users u
JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
WHERE up.inherit_role = false;

-- 6. 检查特定用户权限
SELECT 
    '特定用户权限检查' as category,
    u.email,
    u.role,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板: ' || rpt.name
        WHEN up.inherit_role = true THEN '继承角色权限'
        ELSE '用户特定权限'
    END as permission_source,
    CASE 
        WHEN up.user_id IS NULL THEN array_length(rpt.menu_permissions, 1)
        ELSE array_length(up.menu_permissions, 1)
    END as menu_permissions_count,
    CASE 
        WHEN up.user_id IS NULL THEN array_length(rpt.function_permissions, 1)
        ELSE array_length(up.function_permissions, 1)
    END as function_permissions_count,
    CASE 
        WHEN up.user_id IS NULL THEN array_length(rpt.project_permissions, 1)
        ELSE array_length(up.project_permissions, 1)
    END as project_permissions_count
FROM public.users u
LEFT JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON rpt.role = u.role
WHERE u.role = 'admin'  -- 可以修改这里检查特定角色
ORDER BY u.email;

-- 7. 权限继承逻辑验证
SELECT 
    '权限继承逻辑验证' as category,
    '检查完成' as status,
    '所有用户都应该使用角色模板权限或正确继承权限' as expected,
    '如果发现问题，请运行完整修复脚本' as recommendation;
