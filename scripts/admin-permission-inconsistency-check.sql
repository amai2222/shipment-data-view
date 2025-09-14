-- 检查admin角色权限不一致问题
-- 验证为什么相同角色的用户权限数量不同

-- 1. 检查问题
SELECT 
    '=== Admin角色权限不一致问题检查 ===' as section,
    '验证时间: ' || now() as check_time;

-- 2. 查看所有admin用户
SELECT 
    '=== 所有Admin用户 ===' as section;

SELECT 
    id,
    email,
    username,
    full_name,
    role::text as role,
    is_active,
    created_at
FROM public.profiles 
WHERE role::text = 'admin'
ORDER BY created_at DESC;

-- 3. 查看admin角色权限模板
SELECT 
    '=== Admin角色权限模板 ===' as section;

SELECT 
    role::text as role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions,
    created_at,
    updated_at
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 4. 查看用户自定义权限
SELECT 
    '=== 用户自定义权限 ===' as section;

SELECT 
    up.user_id,
    p.email,
    p.full_name,
    p.role::text as role,
    up.menu_permissions,
    up.function_permissions,
    up.project_permissions,
    up.data_permissions,
    up.created_at
FROM public.user_permissions up
JOIN public.profiles p ON up.user_id = p.id
WHERE p.role::text = 'admin'
ORDER BY up.created_at DESC;

-- 5. 权限数量统计
SELECT 
    '=== 权限数量统计 ===' as section;

-- Admin角色模板权限数量
SELECT 
    'Admin角色模板' as source,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    (array_length(menu_permissions, 1) + 
     array_length(function_permissions, 1) + 
     array_length(project_permissions, 1) + 
     array_length(data_permissions, 1)) as total_count
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 各用户实际权限数量
SELECT 
    p.email,
    p.full_name,
    CASE 
        WHEN up.user_id IS NOT NULL THEN '自定义权限'
        ELSE '角色模板权限'
    END as permission_source,
    COALESCE(array_length(up.menu_permissions, 1), array_length(rpt.menu_permissions, 1)) as menu_count,
    COALESCE(array_length(up.function_permissions, 1), array_length(rpt.function_permissions, 1)) as function_count,
    COALESCE(array_length(up.project_permissions, 1), array_length(rpt.project_permissions, 1)) as project_count,
    COALESCE(array_length(up.data_permissions, 1), array_length(rpt.data_permissions, 1)) as data_count,
    (COALESCE(array_length(up.menu_permissions, 1), array_length(rpt.menu_permissions, 1)) + 
     COALESCE(array_length(up.function_permissions, 1), array_length(rpt.function_permissions, 1)) + 
     COALESCE(array_length(up.project_permissions, 1), array_length(rpt.project_permissions, 1)) + 
     COALESCE(array_length(up.data_permissions, 1), array_length(rpt.data_permissions, 1))) as total_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id
LEFT JOIN public.role_permission_templates rpt ON p.role::text = rpt.role::text
WHERE p.role::text = 'admin'
ORDER BY total_count DESC;

-- 6. 问题分析
SELECT 
    '=== 问题分析 ===' as section,
    '1. 不同admin用户可能有自定义权限' as analysis_1,
    '2. 自定义权限会覆盖角色模板权限' as analysis_2,
    '3. 前端getPermissionCount函数计算不一致' as analysis_3,
    '4. 需要统一权限计算逻辑' as analysis_4;

-- 7. 解决方案
SELECT 
    '=== 解决方案 ===' as section,
    '1. 修复getPermissionCount函数' as solution_1,
    '2. 确保admin角色模板权限一致' as solution_2,
    '3. 清理不一致的自定义权限' as solution_3,
    '4. 统一权限计算逻辑' as solution_4;

-- 8. 修复建议
SELECT 
    '=== 修复建议 ===' as section,
    '1. 检查admin角色模板是否完整' as suggestion_1,
    '2. 清理不必要的自定义权限' as suggestion_2,
    '3. 确保所有admin用户使用相同权限' as suggestion_3,
    '4. 修复前端权限计算逻辑' as suggestion_4;
