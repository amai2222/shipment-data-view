-- 测试权限重复问题修复
-- 验证去重逻辑是否正常工作

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

-- 2. 检查是否有重复的权限
SELECT 
    role,
    'menu_permissions' as permission_type,
    array_length(menu_permissions, 1) as total_count,
    array_length(array(SELECT DISTINCT unnest(menu_permissions)), 1) as unique_count,
    CASE 
        WHEN array_length(menu_permissions, 1) = array_length(array(SELECT DISTINCT unnest(menu_permissions)), 1) 
        THEN '无重复' 
        ELSE '有重复' 
    END as duplicate_status
FROM public.role_permission_templates
WHERE role = 'operator'

UNION ALL

SELECT 
    role,
    'function_permissions' as permission_type,
    array_length(function_permissions, 1) as total_count,
    array_length(array(SELECT DISTINCT unnest(function_permissions)), 1) as unique_count,
    CASE 
        WHEN array_length(function_permissions, 1) = array_length(array(SELECT DISTINCT unnest(function_permissions)), 1) 
        THEN '无重复' 
        ELSE '有重复' 
    END as duplicate_status
FROM public.role_permission_templates
WHERE role = 'operator'

UNION ALL

SELECT 
    role,
    'project_permissions' as permission_type,
    array_length(project_permissions, 1) as total_count,
    array_length(array(SELECT DISTINCT unnest(project_permissions)), 1) as unique_count,
    CASE 
        WHEN array_length(project_permissions, 1) = array_length(array(SELECT DISTINCT unnest(project_permissions)), 1) 
        THEN '无重复' 
        ELSE '有重复' 
    END as duplicate_status
FROM public.role_permission_templates
WHERE role = 'operator'

UNION ALL

SELECT 
    role,
    'data_permissions' as permission_type,
    array_length(data_permissions, 1) as total_count,
    array_length(array(SELECT DISTINCT unnest(data_permissions)), 1) as unique_count,
    CASE 
        WHEN array_length(data_permissions, 1) = array_length(array(SELECT DISTINCT unnest(data_permissions)), 1) 
        THEN '无重复' 
        ELSE '有重复' 
    END as duplicate_status
FROM public.role_permission_templates
WHERE role = 'operator';

-- 3. 清理重复权限（如果需要）
UPDATE public.role_permission_templates 
SET 
    menu_permissions = array(SELECT DISTINCT unnest(menu_permissions)),
    function_permissions = array(SELECT DISTINCT unnest(function_permissions)),
    project_permissions = array(SELECT DISTINCT unnest(project_permissions)),
    data_permissions = array(SELECT DISTINCT unnest(data_permissions)),
    updated_at = NOW()
WHERE role = 'operator';

-- 4. 验证清理后的权限数据
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

-- 5. 发送权限变更通知
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
        'message', 'operator角色权限已清理重复项，总数量: ' || operator_data.total_count
    )::text);
    
    RAISE NOTICE 'operator角色权限已清理重复项，总数量: %', operator_data.total_count;
    RAISE NOTICE '已发送权限变更通知';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '发送通知失败: %', SQLERRM;
END $$;

-- 6. 最终状态检查
SELECT 
    '权限重复问题修复完成' as fix_status,
    '前端去重逻辑已添加' as frontend_fix,
    '数据库重复权限已清理' as database_fix,
    '请测试前端权限保存功能' as next_step;
