-- 修复后的角色管理功能测试
-- 验证动态 SQL 修复是否成功

-- Step 1: 检查函数是否存在
SELECT 'Step 1: 检查数据库函数是否存在' as step;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_enum_value', 'add_enum_value', 'create_role_complete')
ORDER BY routine_name;

-- Step 2: 测试添加枚举值函数
SELECT 'Step 2: 测试添加枚举值函数' as step;
-- 先检查 manager 角色是否已存在
SELECT check_enum_value('app_role', 'manager') as manager_exists;

-- 如果不存在，则添加
DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 角色';
    ELSE
        RAISE NOTICE 'manager 角色已存在';
    END IF;
END $$;

-- Step 3: 验证枚举值是否添加成功
SELECT 'Step 3: 验证枚举值是否添加成功' as step;
SELECT check_enum_value('app_role', 'manager') as manager_exists_after;

-- Step 4: 检查所有枚举值
SELECT 'Step 4: 检查所有枚举值' as step;
SELECT 
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- Step 5: 测试完整角色创建流程
SELECT 'Step 5: 测试完整角色创建流程' as step;
-- 如果 manager 角色不存在，创建它
DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM create_role_complete(
            'manager',
            '项目经理',
            'bg-indigo-500',
            '负责项目管理，包括项目规划、进度跟踪等',
            ARRAY['dashboard', 'dashboard.project', 'maintenance', 'maintenance.projects'],
            ARRAY['data', 'data.create', 'data.edit', 'data.export'],
            ARRAY['project_access', 'project.view_all', 'project.manage'],
            ARRAY['data_scope', 'data.team', 'data_operations']
        );
        RAISE NOTICE '成功创建 manager 角色';
    ELSE
        RAISE NOTICE 'manager 角色已存在，跳过创建';
    END IF;
END $$;

-- Step 6: 验证角色创建结果
SELECT 'Step 6: 验证角色创建结果' as step;
-- 使用安全的方式验证，避免类型转换问题
SELECT 
    '枚举类型检查' as check_type,
    CASE 
        WHEN check_enum_value('app_role', 'manager') THEN '通过'
        ELSE '失败'
    END as status,
    CASE 
        WHEN check_enum_value('app_role', 'manager') THEN '角色已添加到枚举类型'
        ELSE '角色未添加到枚举类型'
    END as details
UNION ALL
SELECT 
    '权限模板检查' as check_type,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = 'manager') THEN '通过'
        ELSE '失败'
    END as status,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = 'manager') THEN '权限模板已创建'
        ELSE '权限模板未创建'
    END as details
UNION ALL
SELECT 
    '项目分配检查' as check_type,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.user_projects WHERE role::text = 'manager') THEN '通过'
        ELSE '警告'
    END as status,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.user_projects WHERE role::text = 'manager') THEN '项目分配已创建'
        ELSE '项目分配未创建（可能没有项目）'
    END as details;

-- Step 7: 检查权限模板
SELECT 'Step 7: 检查权限模板' as step;
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates
WHERE role = 'manager';

-- Step 8: 最终验证
SELECT 'Step 8: 最终验证' as step;
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
