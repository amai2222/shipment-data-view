-- 在数据库中增加新角色
-- 这是角色的主要存储位置

-- 1. 检查当前 app_role 枚举类型
SELECT 'Current app_role enum values:' as info;
SELECT 
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 2. 添加新角色到数据库枚举类型
-- 例如：添加 'manager' 角色
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
        RAISE NOTICE 'Successfully added manager role to database';
    ELSE
        RAISE NOTICE 'Manager role already exists in database';
    END IF;
END $$;

-- 3. 为新角色创建权限模板（存储在数据库中）
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

-- 4. 验证新角色已添加到数据库
SELECT 'Updated app_role enum values:' as info;
SELECT 
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 5. 检查权限模板是否创建成功
SELECT 'Role permission templates in database:' as info;
SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    created_at
FROM public.role_permission_templates
ORDER BY role;

-- 6. 测试新角色是否可以正常使用
SELECT 'Testing new role usage:' as info;
DO $$
DECLARE
    test_role app_role;
BEGIN
    test_role := 'manager'::app_role;
    RAISE NOTICE 'New role % can be used successfully', test_role;
END $$;
