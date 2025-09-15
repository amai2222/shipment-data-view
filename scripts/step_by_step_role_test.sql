-- 分步骤角色管理测试
-- 避免 PostgreSQL 枚举值提交问题

-- 步骤1: 检查现有枚举值
SELECT 'Step 1: 检查现有枚举值' as step;
SELECT enumlabel as role_value FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 步骤2: 检查 manager 是否已存在
SELECT 'Step 2: 检查 manager 是否已存在' as step;
SELECT check_enum_value('app_role', 'manager') as manager_exists;

-- 步骤3: 如果不存在，添加 manager 角色
-- 注意：这个操作需要单独执行，不能在同一个事务中使用新枚举值
DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 角色，请重新运行脚本验证结果';
    ELSE
        RAISE NOTICE 'manager 角色已存在';
    END IF;
END $$;

-- 步骤4: 检查权限模板
SELECT 'Step 4: 检查权限模板' as step;
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates
WHERE role = 'manager';

-- 步骤5: 检查项目分配（使用文本比较）
SELECT 'Step 5: 检查项目分配' as step;
SELECT 
    COUNT(*) as assignment_count,
    COUNT(CASE WHEN can_view = true THEN 1 END) as can_view_count,
    COUNT(CASE WHEN can_edit = true THEN 1 END) as can_edit_count,
    COUNT(CASE WHEN can_delete = true THEN 1 END) as can_delete_count
FROM public.user_projects
WHERE role::text = 'manager';

-- 步骤6: 检查所有角色
SELECT 'Step 6: 检查所有角色' as step;
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
