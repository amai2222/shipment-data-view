-- 权限统计验证脚本
-- 验证前端权限统计计算是否正确

-- 1. 检查权限配置
SELECT 
    '=== 权限统计验证 ===' as section,
    '验证时间: ' || now() as check_time;

-- 2. 检查项目权限配置
SELECT 
    '=== 项目权限配置 ===' as section;

SELECT 
    role,
    name,
    COALESCE(array_length(project_permissions, 1), 0) as project_count,
    project_permissions
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 3. 检查数据权限配置
SELECT 
    '=== 数据权限配置 ===' as section;

SELECT 
    role,
    name,
    COALESCE(array_length(data_permissions, 1), 0) as data_count,
    data_permissions
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 4. 检查当前用户权限
SELECT 
    '=== 当前用户权限 ===' as section;

SELECT 
    p.email,
    p.role::text as role,
    COALESCE(array_length(up.project_permissions, 1), 0) as user_project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as user_data_count,
    up.project_permissions,
    up.data_permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE p.id = auth.uid();

-- 5. 权限统计计算说明
SELECT 
    '=== 权限统计计算说明 ===' as section,
    '1. 项目权限总数: 8个权限项' as project_total,
    '2. 数据权限总数: 8个权限项' as data_total,
    '3. 已授权数量: 用户权限 + 角色权限' as granted_logic,
    '4. 继承数量: 来自角色模板的权限' as inherited_logic,
    '5. 自定义数量: 用户特定权限' as custom_logic;

-- 6. 预期结果
SELECT 
    '=== 预期结果 ===' as section,
    '项目权限: 8/8 (全部继承)' as expected_project,
    '数据权限: 8/8 (全部继承)' as expected_data,
    '菜单权限: 根据配置计算' as expected_menu,
    '功能权限: 根据配置计算' as expected_function;

-- 7. 前端修复说明
SELECT 
    '=== 前端修复说明 ===' as section,
    '1. 修复了权限统计计算逻辑' as fix_1,
    '2. 先计算总数，再计算已授权数量' as fix_2,
    '3. 修复了菜单和功能权限的计算' as fix_3,
    '4. 现在应该正确显示权限数量' as fix_4;

-- 8. 验证步骤
SELECT 
    '=== 验证步骤 ===' as section,
    '1. 刷新权限管理页面' as step_1,
    '2. 检查项目权限是否显示正确数量' as step_2,
    '3. 检查数据权限是否显示正确数量' as step_3,
    '4. 检查权限状态是否正确' as step_4,
    '5. 测试权限功能是否正常' as step_5;
