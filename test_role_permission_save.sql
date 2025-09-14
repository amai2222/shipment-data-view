-- 测试角色权限保存功能
-- 验证前端保存的权限是否正确写入数据库

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

-- 2. 手动更新operator角色权限（添加一个测试权限）
UPDATE public.role_permission_templates 
SET 
    menu_permissions = array_append(menu_permissions, 'test_menu_permission'),
    updated_at = NOW()
WHERE role = 'operator';

-- 3. 检查更新后的权限数据
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
    '数据库operator角色权限数量已更新' as database_status,
    '前端应该显示更新后的权限数量' as frontend_expected,
    '请在前端勾选权限并保存，然后检查控制台输出' as test_instructions;
