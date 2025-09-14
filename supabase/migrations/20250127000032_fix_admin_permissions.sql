-- 修复admin角色权限模板问题
-- 确保admin角色有完整的权限配置

-- 1. 首先检查当前admin角色的权限模板数据
DO $$
BEGIN
    -- 检查是否存在admin角色模板
    IF NOT EXISTS (SELECT 1 FROM public.role_permission_templates WHERE role = 'admin') THEN
        -- 如果不存在，创建admin角色模板
        INSERT INTO public.role_permission_templates (
            role,
            name,
            description,
            menu_permissions,
            function_permissions,
            project_permissions,
            data_permissions,
            is_system,
            is_active,
            color
        ) VALUES (
            'admin',
            '系统管理员',
            '拥有系统所有权限',
            ARRAY['dashboard', 'users', 'contracts', 'reports', 'settings'],
            ARRAY['create_user', 'edit_user', 'delete_user', 'export_data', 'import_data'],
            ARRAY['project_view', 'project_create', 'project_edit', 'project_delete'],
            ARRAY['data_read', 'data_write', 'data_delete'],
            true,
            true,
            'bg-red-500'
        );
        
        RAISE NOTICE '已创建admin角色权限模板';
    ELSE
        -- 如果存在但权限为空，更新权限
        UPDATE public.role_permission_templates 
        SET 
            name = '系统管理员',
            description = '拥有系统所有权限',
            menu_permissions = ARRAY['dashboard', 'users', 'contracts', 'reports', 'settings'],
            function_permissions = ARRAY['create_user', 'edit_user', 'delete_user', 'export_data', 'import_data'],
            project_permissions = ARRAY['project_view', 'project_create', 'project_edit', 'project_delete'],
            data_permissions = ARRAY['data_read', 'data_write', 'data_delete'],
            is_system = true,
            is_active = true,
            color = 'bg-red-500',
            updated_at = now()
        WHERE role = 'admin' 
        AND (
            menu_permissions IS NULL 
            OR array_length(menu_permissions, 1) IS NULL 
            OR array_length(menu_permissions, 1) = 0
        );
        
        RAISE NOTICE '已更新admin角色权限模板';
    END IF;
END $$;

-- 2. 确保所有角色模板的is_active字段都设置为true
UPDATE public.role_permission_templates 
SET is_active = true 
WHERE is_active IS NULL OR is_active = false;

-- 3. 验证修复结果
SELECT 
    role,
    name,
    description,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    is_active
FROM public.role_permission_templates 
ORDER BY role;
