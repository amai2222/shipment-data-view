-- 完全避免枚举值问题的角色创建脚本
-- 使用纯文本操作，避免枚举类型问题

-- 1. 检查当前枚举值
SELECT 'Step 1: 检查当前枚举值' as step;
SELECT enumlabel as role_value FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 2. 检查 manager 是否已存在（使用函数）
SELECT 'Step 2: 检查 manager 是否已存在' as step;
SELECT check_enum_value('app_role', 'manager') as manager_exists;

-- 3. 如果不存在，添加枚举值
DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 枚举值';
    ELSE
        RAISE NOTICE 'manager 枚举值已存在';
    END IF;
END $$;

-- 4. 检查权限模板是否存在
SELECT 'Step 4: 检查权限模板' as step;
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count
FROM public.role_permission_templates
WHERE role = 'manager';

-- 5. 如果权限模板不存在，创建它
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = 'manager') THEN
        INSERT INTO public.role_permission_templates (
            role,
            menu_permissions,
            function_permissions,
            project_permissions,
            data_permissions,
            created_at,
            updated_at
        ) VALUES (
            'manager',
            ARRAY[
                'dashboard', 'dashboard.project',
                'maintenance', 'maintenance.projects',
                'business', 'business.entry',
                'contracts', 'contracts.list', 'contracts.create', 'contracts.edit'
            ],
            ARRAY[
                'data', 'data.create', 'data.edit', 'data.export',
                'project_management', 'project.view_all', 'project.manage'
            ],
            ARRAY[
                'project_access', 'project.view_all', 'project.manage',
                'project_data', 'project_data.view_operational', 'project_data.edit_operational'
            ],
            ARRAY[
                'data_scope', 'data.team',
                'data_operations', 'data.create', 'data.edit', 'data.export'
            ],
            NOW(),
            NOW()
        );
        RAISE NOTICE '成功创建 manager 权限模板';
    ELSE
        RAISE NOTICE 'manager 权限模板已存在';
    END IF;
END $$;

-- 6. 检查项目分配（使用纯文本查询）
SELECT 'Step 6: 检查项目分配' as step;
SELECT 
    COUNT(*) as total_assignments,
    COUNT(CASE WHEN can_view = true THEN 1 END) as can_view_count,
    COUNT(CASE WHEN can_edit = true THEN 1 END) as can_edit_count
FROM public.user_projects
WHERE role::text = 'manager';

-- 7. 最终验证 - 显示所有角色
SELECT 'Step 7: 最终验证' as step;
SELECT 
    'Current roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
