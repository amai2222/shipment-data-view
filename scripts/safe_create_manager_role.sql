-- 分步创建 manager 角色脚本
-- 解决 PostgreSQL 枚举值事务限制问题

-- 步骤 1: 仅添加枚举值
SELECT '步骤 1: 添加 manager 枚举值' as step;

DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 枚举值';
    ELSE
        RAISE NOTICE 'manager 枚举值已存在';
    END IF;
END $$;

-- 提交事务，确保枚举值可用
COMMIT;

-- 步骤 2: 创建权限模板
SELECT '步骤 2: 创建权限模板' as step;

INSERT INTO public.role_permission_templates (
    role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions,
    created_at,
    updated_at
) VALUES (
    'manager'::app_role,
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

-- 步骤 3: 创建项目分配
SELECT '步骤 3: 创建项目分配' as step;

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

-- 步骤 4: 验证结果
SELECT '步骤 4: 验证结果' as step;

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
        WHEN EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = 'manager'::app_role) THEN '通过'
        ELSE '失败'
    END as status
UNION ALL
SELECT 
    '项目分配检查' as check_type,
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.user_projects WHERE role = 'manager'::app_role) THEN '通过'
        ELSE '警告'
    END as status;

-- 步骤 5: 显示最终结果
SELECT '步骤 5: 显示最终结果' as step;
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
