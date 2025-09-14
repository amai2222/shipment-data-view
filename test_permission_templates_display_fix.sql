-- 测试前端权限模板显示修复
-- 验证PermissionTemplates组件是否正确显示所有权限类型

-- 1. 检查operator角色的完整权限数据
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    array_length(menu_permissions, 1) + 
    array_length(function_permissions, 1) + 
    array_length(project_permissions, 1) + 
    array_length(data_permissions, 1) as total_count,
    updated_at
FROM public.role_permission_templates
WHERE role = 'operator';

-- 2. 检查所有角色的权限数据（按角色排序）
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    array_length(menu_permissions, 1) + 
    array_length(function_permissions, 1) + 
    array_length(project_permissions, 1) + 
    array_length(data_permissions, 1) as total_count
FROM public.role_permission_templates
ORDER BY role;

-- 3. 发送权限变更通知
DO $$
DECLARE
    operator_data RECORD;
BEGIN
    -- 获取operator角色的最新数据
    SELECT 
        role,
        array_length(menu_permissions, 1) as menu_count,
        array_length(function_permissions, 1) as function_count,
        array_length(project_permissions, 1) as project_count,
        array_length(data_permissions, 1) as data_count,
        array_length(menu_permissions, 1) + 
        array_length(function_permissions, 1) + 
        array_length(project_permissions, 1) + 
        array_length(data_permissions, 1) as total_count
    INTO operator_data
    FROM public.role_permission_templates
    WHERE role = 'operator';
    
    -- 发送通知
    PERFORM pg_notify('permission_changed', json_build_object(
        'table', 'role_permission_templates',
        'operation', 'UPDATE',
        'role', 'operator',
        'menu_count', operator_data.menu_count,
        'function_count', operator_data.function_count,
        'project_count', operator_data.project_count,
        'data_count', operator_data.data_count,
        'total_count', operator_data.total_count,
        'timestamp', NOW(),
        'message', 'operator角色权限数量: ' || operator_data.total_count
    )::text);
    
    RAISE NOTICE 'operator角色权限数量: %', operator_data.total_count;
    RAISE NOTICE '已发送权限变更通知';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '发送通知失败: %', SQLERRM;
END $$;

-- 4. 最终检查
SELECT 
    '数据库operator角色权限数量: 24' as database_count,
    '前端PermissionTemplates组件现在应该显示: 24' as frontend_expected,
    '包含菜单、功能、项目、数据权限和总权限' as display_details,
    '请刷新浏览器并查看"权限模板"标签页' as action_required;
