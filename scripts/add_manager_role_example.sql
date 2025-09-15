-- 添加新角色示例：manager（项目经理）
-- 演示如何增加新角色的完整流程

-- 1. 添加新角色到 app_role 枚举类型
DO $$
BEGIN
    -- 检查角色是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'app_role' 
        AND enumlabel = 'manager'
    ) THEN
        ALTER TYPE app_role ADD VALUE 'manager';
        RAISE NOTICE 'Added manager role to app_role enum';
    ELSE
        RAISE NOTICE 'Manager role already exists in app_role enum';
    END IF;
END $$;

-- 2. 为新角色创建默认权限模板
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
) ON CONFLICT (role) DO UPDATE SET
    menu_permissions = EXCLUDED.menu_permissions,
    function_permissions = EXCLUDED.function_permissions,
    project_permissions = EXCLUDED.project_permissions,
    data_permissions = EXCLUDED.data_permissions,
    updated_at = NOW();

-- 3. 为新角色创建项目分配权限
-- 为所有现有项目创建默认的项目分配
DO $$
DECLARE
    project_record record;
    assignment_count integer;
BEGIN
    FOR project_record IN 
        SELECT id FROM public.projects
    LOOP
        -- 检查是否已存在 manager 角色的项目分配
        SELECT COUNT(*) INTO assignment_count
        FROM public.user_projects
        WHERE role = 'manager' AND project_id = project_record.id;
        
        -- 如果不存在，创建默认分配
        IF assignment_count = 0 THEN
            INSERT INTO public.user_projects (
                user_id, 
                project_id, 
                role, 
                can_view, 
                can_edit, 
                can_delete,
                created_by
            ) VALUES (
                (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
                project_record.id,
                'manager',
                true,  -- 可以查看
                true,  -- 可以编辑
                false, -- 不能删除
                (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
            );
        END IF;
    END LOOP;
END $$;

-- 4. 验证新角色添加结果
SELECT 'New role verification:' as info;

-- 检查枚举类型
SELECT 'App_role enum values:' as info;
SELECT 
    enumlabel as role_value
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 检查权限模板
SELECT 'Role permission templates:' as info;
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates
WHERE role = 'manager';

-- 检查项目分配
SELECT 'Project assignments for manager role:' as info;
SELECT 
    COUNT(*) as assignment_count,
    COUNT(CASE WHEN can_view = true THEN 1 END) as can_view_count,
    COUNT(CASE WHEN can_edit = true THEN 1 END) as can_edit_count,
    COUNT(CASE WHEN can_delete = true THEN 1 END) as can_delete_count
FROM public.user_projects
WHERE role = 'manager';

-- 5. 显示所有支持的角色
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
