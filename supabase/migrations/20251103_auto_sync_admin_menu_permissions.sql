-- ============================================================================
-- 自动同步管理员菜单权限
-- ============================================================================
-- 功能：当菜单配置变化时，自动更新管理员角色的菜单权限
-- 逻辑：管理员应该能看到所有启用的菜单
-- ============================================================================
-- 创建时间：2025-11-03
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：创建自动同步函数
-- ==========================================

CREATE OR REPLACE FUNCTION auto_sync_admin_menu_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_menu_keys TEXT[];
    v_admin_template_id UUID;
BEGIN
    -- 1. 获取所有启用的菜单项（不包括分组）的 key
    SELECT array_agg(key ORDER BY order_index)
    INTO v_menu_keys
    FROM menu_config
    WHERE is_active = true
      AND is_group = false;

    -- 2. 获取管理员角色模板的 ID
    SELECT id INTO v_admin_template_id
    FROM role_permission_templates
    WHERE role = 'admin';

    -- 3. 如果管理员模板不存在，创建它
    IF v_admin_template_id IS NULL THEN
        INSERT INTO role_permission_templates (
            role,
            menu_permissions,
            function_permissions,
            project_permissions,
            data_permissions
        ) VALUES (
            'admin',
            v_menu_keys,
            ARRAY['all'],
            ARRAY['all'],
            ARRAY['all']
        )
        RETURNING id INTO v_admin_template_id;
        
        RAISE NOTICE '✅ 已创建管理员角色模板，菜单权限: %', array_length(v_menu_keys, 1);
    ELSE
        -- 4. 更新管理员模板的菜单权限
        UPDATE role_permission_templates
        SET 
            menu_permissions = v_menu_keys,
            updated_at = NOW()
        WHERE id = v_admin_template_id;
        
        RAISE NOTICE '✅ 已更新管理员菜单权限，共 % 个菜单', array_length(v_menu_keys, 1);
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '自动同步管理员菜单权限失败: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION auto_sync_admin_menu_permissions IS '自动同步管理员角色的菜单权限（包含所有启用的菜单）';

-- ==========================================
-- 第二步：创建触发器函数
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_sync_admin_menu_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 当菜单配置变化时，同步管理员权限
    -- 使用 PERFORM 而不是直接调用，避免阻塞
    PERFORM auto_sync_admin_menu_permissions();
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION trigger_sync_admin_menu_permissions IS '触发器：菜单变化时自动同步管理员权限';

-- ==========================================
-- 第三步：创建触发器
-- ==========================================

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_auto_sync_admin_on_menu_change ON menu_config;

-- 创建新触发器：当菜单被插入、更新或删除时触发
CREATE TRIGGER trigger_auto_sync_admin_on_menu_change
    AFTER INSERT OR UPDATE OR DELETE ON menu_config
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_sync_admin_menu_permissions();

COMMENT ON TRIGGER trigger_auto_sync_admin_on_menu_change ON menu_config 
IS '自动同步管理员菜单权限（菜单变化时触发）';

-- ==========================================
-- 第四步：立即执行一次同步
-- ==========================================

SELECT auto_sync_admin_menu_permissions();

-- ==========================================
-- 第五步：验证同步结果
-- ==========================================

DO $$
DECLARE
    v_menu_count INTEGER;
    v_admin_permission_count INTEGER;
BEGIN
    -- 统计菜单数
    SELECT COUNT(*) INTO v_menu_count
    FROM menu_config
    WHERE is_active = true AND is_group = false;
    
    -- 统计管理员权限数
    SELECT array_length(menu_permissions, 1) INTO v_admin_permission_count
    FROM role_permission_templates
    WHERE role = 'admin';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 管理员菜单权限自动同步已配置';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '统计信息：';
    RAISE NOTICE '  - 启用的菜单项数: %', v_menu_count;
    RAISE NOTICE '  - 管理员权限数: %', v_admin_permission_count;
    RAISE NOTICE '';
    
    IF v_menu_count = v_admin_permission_count THEN
        RAISE NOTICE '✅ 同步状态：完全一致';
    ELSE
        RAISE WARNING '⚠️ 同步状态：数量不一致，请检查';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '触发时机：';
    RAISE NOTICE '  - 添加新菜单 → 自动添加到管理员权限';
    RAISE NOTICE '  - 删除菜单 → 自动从管理员权限移除';
    RAISE NOTICE '  - 禁用菜单 → 自动从管理员权限移除';
    RAISE NOTICE '  - 启用菜单 → 自动添加到管理员权限';
    RAISE NOTICE '';
    RAISE NOTICE '其他角色：';
    RAISE NOTICE '  - 需要手动配置权限';
    RAISE NOTICE '  - 使用权限同步管理器检查和配置';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 查看管理员当前的菜单权限
-- ==========================================

SELECT 
    'admin 角色菜单权限' AS info,
    menu_permissions
FROM role_permission_templates
WHERE role = 'admin';

