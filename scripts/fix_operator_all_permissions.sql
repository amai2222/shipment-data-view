-- ============================================================================
-- 修复操作员角色的所有权限配置
-- ============================================================================
-- 目标: 操作员拥有管理员的所有权限，仅排除设置相关的权限
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_admin_template RECORD;
    v_operator_menu_permissions TEXT[];
    v_operator_function_permissions TEXT[];
BEGIN
    -- 获取管理员的权限模板
    SELECT 
        menu_permissions,
        function_permissions,
        project_permissions,
        data_permissions
    INTO v_admin_template
    FROM public.role_permission_templates
    WHERE role = 'admin';
    
    IF v_admin_template IS NULL THEN
        RAISE EXCEPTION '管理员角色模板不存在';
    END IF;
    
    -- ============================================================================
    -- Step 1: 修复菜单权限（移除设置菜单相关，7个）
    -- ============================================================================
    SELECT array_agg(DISTINCT menu_key ORDER BY menu_key)
    INTO v_operator_menu_permissions
    FROM unnest(v_admin_template.menu_permissions) AS menu_key
    WHERE menu_key NOT LIKE 'settings%';
    
    -- ============================================================================
    -- Step 2: 修复功能权限（移除设置相关的功能权限）
    -- ============================================================================
    SELECT array_agg(DISTINCT func_key ORDER BY func_key)
    INTO v_operator_function_permissions
    FROM unnest(v_admin_template.function_permissions) AS func_key
    WHERE func_key NOT LIKE 'system%';  -- 移除系统管理相关的功能权限
    
    -- ============================================================================
    -- Step 3: 更新操作员权限（项目权限和数据权限保持与管理员一致）
    -- ============================================================================
    UPDATE public.role_permission_templates
    SET 
        menu_permissions = v_operator_menu_permissions,
        function_permissions = v_operator_function_permissions,
        -- 项目权限和数据权限与管理员保持一致
        project_permissions = v_admin_template.project_permissions,
        data_permissions = v_admin_template.data_permissions,
        updated_at = NOW()
    WHERE role = 'operator';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '操作员角色模板不存在';
    END IF;
    
    -- ============================================================================
    -- Step 4: 验证结果
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 操作员所有权限已更新';
    RAISE NOTICE '========================================';
    RAISE NOTICE '菜单权限:';
    RAISE NOTICE '  管理员: % 个', array_length(v_admin_template.menu_permissions, 1);
    RAISE NOTICE '  操作员: % 个', array_length(v_operator_menu_permissions, 1);
    RAISE NOTICE '  差异: % 个 (设置菜单)', 
        array_length(v_admin_template.menu_permissions, 1) - array_length(v_operator_menu_permissions, 1);
    RAISE NOTICE '';
    RAISE NOTICE '功能权限:';
    RAISE NOTICE '  管理员: % 个', array_length(v_admin_template.function_permissions, 1);
    RAISE NOTICE '  操作员: % 个', array_length(v_operator_function_permissions, 1);
    RAISE NOTICE '  差异: % 个 (系统管理功能)', 
        array_length(v_admin_template.function_permissions, 1) - array_length(v_operator_function_permissions, 1);
    RAISE NOTICE '';
    RAISE NOTICE '项目权限: 与管理员一致 (% 个)', 
        array_length(v_admin_template.project_permissions, 1);
    RAISE NOTICE '数据权限: 与管理员一致 (% 个)', 
        array_length(v_admin_template.data_permissions, 1);
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

