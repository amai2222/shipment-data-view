-- 测试新角色创建功能
-- 验证前端角色管理功能是否正常工作

-- 1. 首先运行数据库函数创建脚本
-- 确保所有必要的函数都已创建
\echo 'Step 1: 检查数据库函数是否存在'

-- 检查函数是否存在
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_enum_value', 'add_enum_value', 'create_role_complete', 'get_all_roles')
ORDER BY routine_name;

-- 2. 测试创建新角色
\echo 'Step 2: 测试创建新角色 manager'

-- 使用函数创建新角色
SELECT create_role_complete(
    'manager',
    '项目经理',
    'bg-indigo-500',
    '负责项目管理，包括项目规划、进度跟踪等',
    ARRAY['dashboard', 'dashboard.project', 'maintenance', 'maintenance.projects', 'business', 'business.entry'],
    ARRAY['data', 'data.create', 'data.edit', 'data.export', 'project_management', 'project.view_all', 'project.manage'],
    ARRAY['project_access', 'project.view_all', 'project.manage', 'project_data', 'project_data.view_operational', 'project_data.edit_operational'],
    ARRAY['data_scope', 'data.team', 'data_operations', 'data.create', 'data.edit', 'data.export']
);

-- 3. 验证角色创建结果
\echo 'Step 3: 验证角色创建结果'

-- 使用验证函数检查结果
SELECT * FROM verify_role_creation('manager');

-- 4. 检查所有角色
\echo 'Step 4: 检查所有角色'

-- 获取所有角色信息
SELECT * FROM get_all_roles();

-- 5. 测试枚举类型
\echo 'Step 5: 测试枚举类型'

-- 检查 app_role 枚举类型的所有值
SELECT 
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 6. 测试权限模板
\echo 'Step 6: 测试权限模板'

-- 检查新角色的权限模板
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    created_at
FROM public.role_permission_templates
WHERE role = 'manager';

-- 7. 测试项目分配
\echo 'Step 7: 测试项目分配'

-- 检查新角色的项目分配
SELECT 
    COUNT(*) as assignment_count,
    COUNT(CASE WHEN can_view = true THEN 1 END) as can_view_count,
    COUNT(CASE WHEN can_edit = true THEN 1 END) as can_edit_count,
    COUNT(CASE WHEN can_delete = true THEN 1 END) as can_delete_count
FROM public.user_projects
WHERE role = 'manager';

-- 8. 测试类型转换
\echo 'Step 8: 测试类型转换'

-- 测试新角色是否可以正常使用
DO $$
DECLARE
    test_role app_role;
BEGIN
    test_role := 'manager'::app_role;
    RAISE NOTICE '新角色 % 类型转换成功', test_role;
END $$;

-- 9. 清理测试数据（可选）
\echo 'Step 9: 清理测试数据（可选）'

-- 如果需要清理测试数据，取消注释以下代码
/*
SELECT delete_role_complete('manager');
*/

-- 10. 最终验证
\echo 'Step 10: 最终验证'

-- 显示支持的角色信息
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
