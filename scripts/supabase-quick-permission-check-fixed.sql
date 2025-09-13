-- Supabase 简化权限检查脚本（修复类型转换问题）
-- 专门解决 app_role 枚举类型与 text 类型的转换问题

-- 1. 快速权限状态检查
SELECT 
    '=== Supabase 权限系统快速检查 ===' as section,
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

-- 3. 用户权限继承状态（修复类型转换）
SELECT 
    '用户权限继承状态' as category,
    p.role::text as role,  -- 显式转换为 text 类型
    COUNT(*) as total_users,
    COUNT(CASE WHEN up.user_id IS NULL THEN 1 END) as use_role_template,
    COUNT(CASE WHEN up.inherit_role = true THEN 1 END) as inherit_role,
    COUNT(CASE WHEN up.inherit_role = false THEN 1 END) as custom_permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
GROUP BY p.role::text
ORDER BY p.role::text;

-- 4. 权限继承问题检查（修复类型转换）
SELECT 
    '权限继承问题检查' as category,
    p.email,
    p.role::text as role,  -- 显式转换为 text 类型
    CASE 
        WHEN up.user_id IS NOT NULL AND up.inherit_role = false THEN '❌ 不继承角色权限'
        WHEN up.user_id IS NOT NULL AND up.inherit_role = true THEN '⚠️ 继承角色权限但有用户特定权限'
        WHEN up.user_id IS NULL THEN '✅ 使用角色模板权限'
        ELSE '❓ 状态未知'
    END as status
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.user_id IS NOT NULL AND up.inherit_role = false
ORDER BY p.role::text, p.email;

-- 5. 权限统计摘要（修复类型转换）
SELECT 
    '权限统计摘要' as category,
    '总用户数' as metric,
    COUNT(*) as value
FROM public.profiles

UNION ALL

SELECT 
    '权限统计摘要' as category,
    '使用角色模板权限的用户' as metric,
    COUNT(*) as value
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.user_id IS NULL

UNION ALL

SELECT 
    '权限统计摘要' as category,
    '有用户特定权限的用户' as metric,
    COUNT(*) as value
FROM public.profiles p
JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.inherit_role = false;

-- 6. 检查特定用户权限（修复类型转换）
SELECT 
    '特定用户权限检查' as category,
    p.email,
    p.role::text as role,  -- 显式转换为 text 类型
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
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON rpt.role::text = p.role::text
WHERE p.role::text = 'admin'  -- 可以修改这里检查特定角色
ORDER BY p.email;

-- 7. 权限继承逻辑验证
SELECT 
    '权限继承逻辑验证' as category,
    '检查完成' as status,
    '所有用户都应该使用角色模板权限或正确继承权限' as expected,
    '类型转换问题已修复' as fix_status;
