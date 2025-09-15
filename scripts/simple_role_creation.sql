-- 最简单的角色创建脚本
-- 分两个独立的事务执行

-- 第一部分：添加枚举值
-- 执行这部分后，需要重新连接数据库或提交事务

DO $$
BEGIN
    -- 检查 manager 是否已存在
    IF NOT EXISTS(
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'app_role' 
        AND enumlabel = 'manager'
    ) THEN
        -- 添加枚举值
        ALTER TYPE app_role ADD VALUE 'manager';
        RAISE NOTICE '成功添加 manager 枚举值';
    ELSE
        RAISE NOTICE 'manager 枚举值已存在';
    END IF;
END $$;

-- 第二部分：创建权限模板和项目分配
-- 这部分需要在枚举值提交后执行

DO $$
BEGIN
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
    ) ON CONFLICT (role) DO NOTHING;
    
    RAISE NOTICE '权限模板创建完成';
    
    -- 创建项目分配（使用文本比较）
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
        AND up.role::text = 'manager'
    );
    
    RAISE NOTICE '项目分配创建完成';
END $$;

-- 验证结果
SELECT '验证结果' as step;
SELECT 
    '枚举值检查' as check_type,
    CASE 
        WHEN EXISTS(
            SELECT 1 FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'app_role' 
            AND enumlabel = 'manager'
        ) THEN '通过'
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
