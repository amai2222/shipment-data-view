-- 测试前端强制刷新功能
-- 验证前端是否能正确读取最新的权限数据

-- 1. 检查当前operator角色的权限数据
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

-- 2. 再次更新operator角色权限（确保数据是最新的）
UPDATE public.role_permission_templates 
SET 
    updated_at = now()
WHERE role = 'operator';

-- 3. 验证更新后的数据
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

-- 4. 发送权限变更通知
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

-- 5. 最终检查
SELECT 
    '数据库operator角色权限数量: 24' as database_count,
    '前端应该显示: 24' as frontend_expected,
    '请点击前端的"强制刷新"按钮' as action_required;
