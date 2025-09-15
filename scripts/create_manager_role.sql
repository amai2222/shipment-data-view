-- 创建 manager 角色脚本
-- 专门用于创建新角色，避免测试中的枚举值问题

-- 1. 检查 manager 角色是否已存在
SELECT '检查 manager 角色是否已存在' as step;
SELECT check_enum_value('app_role', 'manager') as manager_exists;

-- 2. 如果不存在，创建 manager 角色
DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        -- 添加枚举值
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 枚举值';
        
        -- 创建权限模板
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
        
        -- 为新角色创建项目分配（使用管理员用户作为占位符）
        INSERT INTO public.user_projects (
            user_id,
            project_id,
            role,
            can_view,
            can_edit,
            can_delete,
            created_by
        )
        SELECT 
            (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
            p.id,
            'manager'::app_role,
            true,
            true,
            false,
            (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
        FROM public.projects p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_projects up 
            WHERE up.user_id = (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
            AND up.project_id = p.id 
            AND up.role = 'manager'::app_role
        );
        RAISE NOTICE '成功创建 manager 项目分配';
        
        RAISE NOTICE 'manager 角色创建完成！';
    ELSE
        RAISE NOTICE 'manager 角色已存在，跳过创建';
    END IF;
END $$;

-- 3. 验证创建结果
SELECT '验证创建结果' as step;
SELECT 
    '枚举类型检查' as check_type,
    CASE 
        WHEN check_enum_value('app_role', 'manager') THEN '通过'
        ELSE '失败'
    END as status
UNION ALL
SELECT 
    '权限模板检查' as check_type,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = 'manager') THEN '通过'
        ELSE '失败'
    END as status
UNION ALL
SELECT 
    '项目分配检查' as check_type,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.user_projects WHERE role::text = 'manager') THEN '通过'
        ELSE '警告'
    END as status;

-- 4. 显示最终结果
SELECT '最终结果' as step;
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
