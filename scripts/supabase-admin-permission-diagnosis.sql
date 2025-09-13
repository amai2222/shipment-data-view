-- Supabase 超级管理员权限问题诊断脚本
-- 检查为什么超级管理员权限显示为空

-- 1. 检查当前用户权限状态
SELECT 
    '=== 超级管理员权限问题诊断 ===' as section,
    '诊断时间: ' || now() as check_time;

-- 2. 检查当前登录用户信息
SELECT 
    '=== 当前用户信息 ===' as section,
    '用户ID: ' || auth.uid() as current_user_id;

-- 3. 检查用户角色配置
SELECT 
    '=== 用户角色配置检查 ===' as section,
    p.id,
    p.email,
    p.role::text as role,
    p.is_active,
    p.created_at
FROM public.profiles p
WHERE p.id = auth.uid();

-- 4. 检查角色权限模板
SELECT 
    '=== 角色权限模板检查 ===' as section,
    role,
    name,
    COALESCE(array_length(menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(function_permissions, 1), 0) as function_count,
    COALESCE(array_length(project_permissions, 1), 0) as project_count,
    COALESCE(array_length(data_permissions, 1), 0) as data_count,
    created_at,
    updated_at
FROM public.role_permission_templates 
ORDER BY role;

-- 5. 检查用户特定权限
SELECT 
    '=== 用户特定权限检查 ===' as section,
    up.user_id,
    up.project_id,
    up.inherit_role,
    COALESCE(array_length(up.menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(up.function_permissions, 1), 0) as function_count,
    COALESCE(array_length(up.project_permissions, 1), 0) as project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as data_count,
    up.created_at,
    up.updated_at
FROM public.user_permissions up
WHERE up.user_id = auth.uid();

-- 6. 检查权限继承逻辑
SELECT 
    '=== 权限继承逻辑检查 ===' as section,
    p.email,
    p.role::text as role,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板权限'
        WHEN up.inherit_role = true THEN '继承角色权限'
        WHEN up.inherit_role = false THEN '用户特定权限'
        ELSE '状态未知'
    END as permission_source,
    CASE 
        WHEN up.user_id IS NULL THEN rpt.name
        ELSE '用户特定权限'
    END as permission_template
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON rpt.role::text = p.role::text
WHERE p.id = auth.uid();

-- 7. 检查admin角色的具体权限
SELECT 
    '=== Admin角色权限详情 ===' as section,
    '菜单权限' as permission_type,
    unnest(menu_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'

UNION ALL

SELECT 
    '=== Admin角色权限详情 ===' as section,
    '功能权限' as permission_type,
    unnest(function_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'

UNION ALL

SELECT 
    '=== Admin角色权限详情 ===' as section,
    '项目权限' as permission_type,
    unnest(project_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'

UNION ALL

SELECT 
    '=== Admin角色权限详情 ===' as section,
    '数据权限' as permission_type,
    unnest(data_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'

ORDER BY permission_type, permission_key;

-- 8. 检查权限检查函数结果
SELECT 
    '=== 权限检查函数结果 ===' as section;

SELECT * FROM check_permission_inheritance() 
WHERE user_id = auth.uid();

-- 9. 检查权限检查视图结果
SELECT 
    '=== 权限检查视图结果 ===' as section;

SELECT 
    id,
    email,
    role,
    permission_type,
    permission_source,
    array_length(effective_menu_permissions, 1) as menu_count,
    array_length(effective_function_permissions, 1) as function_count,
    array_length(effective_project_permissions, 1) as project_count,
    array_length(effective_data_permissions, 1) as data_count
FROM user_permission_status 
WHERE id = auth.uid();

-- 10. 检查可能的问题
SELECT 
    '=== 可能的问题检查 ===' as section,
    '1. 用户角色不是admin' as issue_1,
    '2. 角色权限模板为空' as issue_2,
    '3. 用户有特定权限但inherit_role=false' as issue_3,
    '4. 权限检查函数有问题' as issue_4,
    '5. 前端权限判断逻辑有问题' as issue_5;

-- 11. 修复建议
SELECT 
    '=== 修复建议 ===' as section,
    '1. 确保用户角色是admin' as suggestion_1,
    '2. 检查角色权限模板配置' as suggestion_2,
    '3. 清理用户特定权限' as suggestion_3,
    '4. 重新创建权限检查函数' as suggestion_4,
    '5. 检查前端权限判断逻辑' as suggestion_5;

-- 12. 快速修复脚本
SELECT 
    '=== 快速修复脚本 ===' as section,
    '1. 更新用户角色为admin' as fix_1,
    '2. 清理用户特定权限' as fix_2,
    '3. 重新创建权限检查函数' as fix_3,
    '4. 验证修复结果' as fix_4;
