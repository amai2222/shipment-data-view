-- ==========================================
-- 修复菜单权限Key - 删除无效的父级Key
-- ==========================================
-- 创建时间: 2025-10-29
-- 问题: role_permission_templates 表中包含无效的父级菜单Key
-- 原因: 这些父级Key（如 dashboard, maintenance）在 AppSidebar.tsx 中没有映射
-- 解决: 删除所有无效的父级Key，只保留具体的子菜单Key
-- ==========================================

BEGIN;

-- 定义无效的Key列表
DO $$
DECLARE
    v_invalid_keys text[] := ARRAY[
        'dashboard',
        'maintenance', 
        'business',
        'finance',
        'contracts',
        'data_maintenance',
        'settings'
    ];
BEGIN
    RAISE NOTICE '开始清理无效的菜单权限Key...';
    RAISE NOTICE '无效Key列表: %', array_to_string(v_invalid_keys, ', ');
END $$;

-- 更新所有角色的菜单权限，删除无效Key
UPDATE public.role_permission_templates
SET menu_permissions = (
    SELECT ARRAY_AGG(perm)
    FROM unnest(menu_permissions) AS perm
    WHERE perm NOT IN ('dashboard', 'maintenance', 'business', 'finance', 'contracts', 'data_maintenance', 'settings')
);

-- 同样更新 user_permissions 表中的自定义权限
UPDATE public.user_permissions
SET menu_permissions = (
    SELECT ARRAY_AGG(perm)
    FROM unnest(menu_permissions) AS perm
    WHERE perm NOT IN ('dashboard', 'maintenance', 'business', 'finance', 'contracts', 'data_maintenance', 'settings')
)
WHERE project_id IS NULL;

-- 验证结果
DO $$
DECLARE
    v_role record;
    v_has_invalid boolean := false;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 清理完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 检查每个角色的权限
    FOR v_role IN 
        SELECT role, menu_permissions 
        FROM public.role_permission_templates 
        ORDER BY role
    LOOP
        RAISE NOTICE '角色: % - 菜单权限数量: %', v_role.role, array_length(v_role.menu_permissions, 1);
        
        -- 检查是否还有无效Key
        IF v_role.menu_permissions && ARRAY['dashboard', 'maintenance', 'business', 'finance', 'contracts', 'data_maintenance', 'settings'] THEN
            v_has_invalid := true;
            RAISE WARNING '  ⚠️  仍包含无效Key!';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    IF NOT v_has_invalid THEN
        RAISE NOTICE '✅ 所有无效Key已清理';
        RAISE NOTICE '现在菜单权限应该能正常生效了！';
    ELSE
        RAISE WARNING '⚠️  仍有角色包含无效Key，请手动检查';
    END IF;
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- 使用提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📝 后续操作建议';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '1. 在权限管理界面重新配置菜单权限';
    RAISE NOTICE '2. 确保选择的是具体的子菜单项，例如:';
    RAISE NOTICE '   ✅ dashboard.transport (运输看板)';
    RAISE NOTICE '   ✅ maintenance.projects (项目管理)';
    RAISE NOTICE '   ✅ business.entry (运单管理)';
    RAISE NOTICE '   ❌ 不要选择 dashboard, maintenance 等父级';
    RAISE NOTICE '';
    RAISE NOTICE '3. 刷新页面，菜单应该能正常显示了';
    RAISE NOTICE '========================================';
END $$;

