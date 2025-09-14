-- 修复admin角色权限不一致问题
-- 确保所有admin用户使用相同的权限模板

-- 1. 检查当前admin用户权限状态
SELECT 
    '=== 当前Admin用户权限状态 ===' as section;

SELECT 
    p.email,
    p.full_name,
    CASE 
        WHEN up.user_id IS NOT NULL THEN '有自定义权限'
        ELSE '使用角色模板'
    END as permission_status,
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

-- 2. 获取admin角色模板权限
SELECT 
    '=== Admin角色模板权限 ===' as section;

SELECT 
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 3. 删除所有admin用户的自定义权限（让他们使用角色模板）
DELETE FROM public.user_permissions 
WHERE user_id IN (
    SELECT id FROM public.profiles WHERE role::text = 'admin'
);

-- 4. 验证修复结果
SELECT 
    '=== 修复后Admin用户权限状态 ===' as section;

SELECT 
    p.email,
    p.full_name,
    '使用角色模板' as permission_status,
    array_length(rpt.menu_permissions, 1) as menu_count,
    array_length(rpt.function_permissions, 1) as function_count,
    array_length(rpt.project_permissions, 1) as project_count,
    array_length(rpt.data_permissions, 1) as data_count,
    (array_length(rpt.menu_permissions, 1) + 
     array_length(rpt.function_permissions, 1) + 
     array_length(rpt.project_permissions, 1) + 
     array_length(rpt.data_permissions, 1)) as total_count
FROM public.profiles p
JOIN public.role_permission_templates rpt ON p.role::text = rpt.role::text
WHERE p.role::text = 'admin'
ORDER BY p.created_at DESC;

-- 5. 确保admin角色模板权限完整
SELECT 
    '=== 确保Admin角色模板权限完整 ===' as section;

-- 检查菜单权限数量
SELECT 
    '菜单权限数量: ' || array_length(menu_permissions, 1) as menu_check
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 检查功能权限数量
SELECT 
    '功能权限数量: ' || array_length(function_permissions, 1) as function_check
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 检查项目权限数量
SELECT 
    '项目权限数量: ' || array_length(project_permissions, 1) as project_check
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 检查数据权限数量
SELECT 
    '数据权限数量: ' || array_length(data_permissions, 1) as data_check
FROM public.role_permission_templates 
WHERE role::text = 'admin';

-- 6. 预期结果
SELECT 
    '=== 预期结果 ===' as section,
    '所有admin用户应该显示相同的权限数量' as expected_1,
    '菜单权限: 35个' as expected_2,
    '功能权限: 37个' as expected_3,
    '项目权限: 10个' as expected_4,
    '数据权限: 10个' as expected_5,
    '总权限: 92个' as expected_6;

-- 7. 验证步骤
SELECT 
    '=== 验证步骤 ===' as section,
    '1. 刷新集成权限管理页面' as step_1,
    '2. 切换到权限配置标签页' as step_2,
    '3. 检查所有admin用户的权限数量' as step_3,
    '4. 确认所有admin用户显示92项权限' as step_4,
    '5. 点击任意admin用户查看详细权限' as step_5;
