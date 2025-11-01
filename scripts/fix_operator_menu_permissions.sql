-- ============================================================================
-- 修复操作员角色的菜单权限配置
-- ============================================================================
-- 问题: 操作员角色的菜单权限数量不正确，应该是管理员的权限减去设置菜单
-- 目标: 将操作员权限设置为 管理员权限 - 设置菜单（7个）= 40个菜单权限
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: 获取管理员的菜单权限
-- ============================================================================

DO $$
DECLARE
    v_admin_menu_permissions TEXT[];
    v_operator_menu_permissions TEXT[];
    v_final_operator_permissions TEXT[];
BEGIN
    -- 获取管理员的菜单权限
    SELECT menu_permissions INTO v_admin_menu_permissions
    FROM public.role_permission_templates
    WHERE role = 'admin';
    
    IF v_admin_menu_permissions IS NULL THEN
        RAISE EXCEPTION '管理员角色模板不存在或菜单权限为空';
    END IF;
    
    -- ============================================================================
    -- Step 2: 从管理员权限中移除设置相关的权限
    -- ============================================================================
    -- 根据用户要求：操作员只比管理员少设置菜单及其子菜单（7个）
    -- 移除所有 settings 相关的权限
    
    SELECT array_agg(DISTINCT menu_key ORDER BY menu_key)
    INTO v_final_operator_permissions
    FROM unnest(v_admin_menu_permissions) AS menu_key
    WHERE menu_key NOT LIKE 'settings%';
    
    -- ============================================================================
    -- Step 4: 更新操作员角色的菜单权限
    -- ============================================================================
    
    UPDATE public.role_permission_templates
    SET 
        menu_permissions = v_final_operator_permissions,
        updated_at = NOW()
    WHERE role = 'operator';
    
    IF NOT FOUND THEN
        -- 如果操作员模板不存在，创建一个
        INSERT INTO public.role_permission_templates (
            role,
            name,
            description,
            menu_permissions,
            function_permissions,
            project_permissions,
            data_permissions,
            is_system,
            updated_at
        )
        SELECT 
            'operator',
            '操作员',
            '业务操作人员，拥有大部分业务权限，但无系统管理权限',
            v_final_operator_permissions,
            function_permissions,
            project_permissions,
            data_permissions,
            true,
            NOW()
        FROM public.role_permission_templates
        WHERE role = 'admin';
    END IF;
    
    -- ============================================================================
    -- Step 5: 验证结果
    -- ============================================================================
    
    SELECT menu_permissions INTO v_operator_menu_permissions
    FROM public.role_permission_templates
    WHERE role = 'operator';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 操作员菜单权限已更新';
    RAISE NOTICE '========================================';
    RAISE NOTICE '管理员菜单权限数量: %', array_length(v_admin_menu_permissions, 1);
    RAISE NOTICE '操作员菜单权限数量: %', array_length(v_operator_menu_permissions, 1);
    RAISE NOTICE '差异数量: % (应该是7个设置菜单权限)', 
        array_length(v_admin_menu_permissions, 1) - array_length(v_operator_menu_permissions, 1);
    RAISE NOTICE '';
    RAISE NOTICE '操作员缺少的权限（仅设置菜单）:';
    RAISE NOTICE '  - settings (设置主菜单)';
    RAISE NOTICE '  - settings.users (用户管理)';
    RAISE NOTICE '  - settings.permissions (权限配置)';
    RAISE NOTICE '  - settings.contract_permissions (合同权限)';
    RAISE NOTICE '  - settings.role_templates (角色模板)';
    RAISE NOTICE '  - settings.integrated (集成权限管理)';
    RAISE NOTICE '  - settings.audit_logs (操作日志)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- 验证查询
-- ============================================================================

SELECT 
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates
WHERE role IN ('admin', 'operator')
ORDER BY role;

