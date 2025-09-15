-- 安全的角色管理功能测试
-- 避免类型转换问题

-- 1. 检查函数是否存在
SELECT '检查函数是否存在' as test_step;
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_enum_value', 'add_enum_value', 'create_role_complete')
ORDER BY routine_name;

-- 2. 检查当前枚举值
SELECT '当前枚举值' as test_step;
SELECT enumlabel as role_value FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 3. 测试检查函数
SELECT '测试检查函数' as test_step;
SELECT 
    check_enum_value('app_role', 'admin') as admin_exists,
    check_enum_value('app_role', 'manager') as manager_exists;

-- 4. 测试添加枚举值（如果 manager 不存在）
DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 角色';
    ELSE
        RAISE NOTICE 'manager 角色已存在';
    END IF;
END $$;

-- 5. 验证添加结果
SELECT '验证添加结果' as test_step;
SELECT check_enum_value('app_role', 'manager') as manager_exists_after;

-- 6. 检查更新后的枚举值
SELECT '更新后的枚举值' as test_step;
SELECT enumlabel as role_value FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 7. 测试类型转换
SELECT '测试类型转换' as test_step;
DO $$
DECLARE
    test_role app_role;
BEGIN
    test_role := 'manager'::app_role;
    RAISE NOTICE '类型转换成功: %', test_role;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '类型转换失败: %', SQLERRM;
END $$;

-- 8. 检查权限模板（安全方式）
SELECT '检查权限模板' as test_step;
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates
WHERE role = 'manager';

-- 9. 检查项目分配（安全方式）
SELECT '检查项目分配' as test_step;
SELECT 
    COUNT(*) as assignment_count,
    COUNT(CASE WHEN can_view = true THEN 1 END) as can_view_count,
    COUNT(CASE WHEN can_edit = true THEN 1 END) as can_edit_count,
    COUNT(CASE WHEN can_delete = true THEN 1 END) as can_delete_count
FROM public.user_projects
WHERE role::text = 'manager';

-- 10. 最终验证
SELECT '最终验证' as test_step;
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
