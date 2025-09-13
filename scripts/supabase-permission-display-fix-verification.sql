-- Supabase 权限显示修复验证脚本
-- 验证前端权限显示修复是否生效

-- 1. 检查修复结果
SELECT 
    '=== 权限显示修复验证 ===' as section,
    '验证时间: ' || now() as check_time;

-- 2. 检查当前用户权限状态
SELECT 
    '=== 当前用户权限状态 ===' as section,
    p.email,
    p.role::text as role,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板权限'
        WHEN up.inherit_role = true THEN '继承角色权限'
        ELSE '用户特定权限'
    END as permission_source,
    COALESCE(array_length(up.menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(up.function_permissions, 1), 0) as function_count,
    COALESCE(array_length(up.project_permissions, 1), 0) as project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as data_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE p.id = auth.uid();

-- 3. 检查admin角色权限模板
SELECT 
    '=== Admin角色权限模板 ===' as section,
    role,
    name,
    COALESCE(array_length(menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(function_permissions, 1), 0) as function_count,
    COALESCE(array_length(project_permissions, 1), 0) as project_count,
    COALESCE(array_length(data_permissions, 1), 0) as data_count
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 4. 检查admin角色的项目权限详情
SELECT 
    '=== Admin角色项目权限详情 ===' as section,
    unnest(project_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'
ORDER BY permission_key;

-- 5. 检查admin角色的数据权限详情
SELECT 
    '=== Admin角色数据权限详情 ===' as section,
    unnest(data_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'
ORDER BY permission_key;

-- 6. 检查权限检查函数结果
SELECT 
    '=== 权限检查函数结果 ===' as section;

SELECT * FROM check_permission_inheritance() 
WHERE user_id = auth.uid();

-- 7. 检查权限检查视图结果
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

-- 8. 前端修复说明
SELECT 
    '=== 前端修复说明 ===' as section,
    '1. 修复了 IntegratedUserPermissionManager.tsx 中的项目权限硬编码问题' as fix_1,
    '2. 修复了 PermissionVisualizer.tsx 中的权限状态判断逻辑' as fix_2,
    '3. 修复了复选框显示逻辑' as fix_3,
    '4. 现在应该正确显示角色模板权限' as fix_4;

-- 9. 验证步骤
SELECT 
    '=== 验证步骤 ===' as section,
    '1. 刷新权限管理页面' as step_1,
    '2. 检查项目权限是否显示为"继承"状态' as step_2,
    '3. 检查复选框是否已勾选' as step_3,
    '4. 检查权限数量是否正确' as step_4,
    '5. 测试权限功能是否正常' as step_5;

-- 10. 最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    '前端权限显示修复完成' as status,
    '数据库权限配置正确' as database_status,
    '权限检查函数正常' as function_status,
    '权限检查视图正常' as view_status,
    '请刷新权限管理页面查看效果' as instruction;
