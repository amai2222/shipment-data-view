-- ============================================================================
-- 改进 admin 权限保护触发器
-- ============================================================================
-- 目标：
--   - 允许清理过期权限（菜单不存在的）
--   - 阻止删除有效权限（菜单存在的）
-- ============================================================================

BEGIN;

-- 删除旧的保护触发器
DROP TRIGGER IF EXISTS prevent_admin_reduction_trigger ON role_permission_templates;
DROP FUNCTION IF EXISTS prevent_admin_permission_reduction();

-- 创建改进的保护函数
CREATE OR REPLACE FUNCTION prevent_admin_permission_reduction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_total INTEGER;
    v_new_total INTEGER;
    v_valid_menus_count INTEGER;
    v_new_valid_count INTEGER;
BEGIN
    -- 只检查 admin 角色
    IF NEW.role = 'admin' THEN
        -- 计算旧权限数量
        v_old_total := COALESCE(array_length(OLD.menu_permissions, 1), 0);
        
        -- 计算新权限数量
        v_new_total := COALESCE(array_length(NEW.menu_permissions, 1), 0);
        
        -- 如果权限减少，检查是否合理
        IF v_new_total < v_old_total THEN
            -- 获取实际存在的菜单数量
            SELECT COUNT(*) INTO v_valid_menus_count
            FROM menu_config
            WHERE is_active = true AND is_group = false;
            
            -- 计算新权限中有效的菜单数量
            SELECT COUNT(*) INTO v_new_valid_count
            FROM menu_config m
            WHERE m.is_active = true 
              AND m.is_group = false
              AND m.key = ANY(NEW.menu_permissions);
            
            -- 如果新权限数量 >= 有效菜单数量，说明是合理的清理
            IF v_new_valid_count >= v_valid_menus_count THEN
                RAISE NOTICE '✅ admin 权限清理合理：删除了 % 个过期权限', v_old_total - v_new_total;
                RETURN NEW;
            END IF;
            
            -- 如果新权限数量 < 有效菜单数量，说明删除了有效权限，阻止
            RAISE EXCEPTION '🛡️ 禁止减少 admin 角色权限！当前: % 个，尝试改为: % 个。admin 必须拥有完整权限。', 
                v_old_total, v_new_total
                USING HINT = '如需清理过期权限，请使用 force-clean-admin-permissions.sql 脚本';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_admin_permission_reduction() IS '智能保护 admin 权限：允许清理过期权限，阻止删除有效权限';

-- 重新创建触发器
CREATE TRIGGER prevent_admin_reduction_trigger
    BEFORE UPDATE ON role_permission_templates
    FOR EACH ROW
    WHEN (NEW.role = 'admin')
    EXECUTE FUNCTION prevent_admin_permission_reduction();

COMMIT;

-- 验证触发器
SELECT 
    '========================================' AS info;
    
SELECT 
    '✅ admin 保护触发器已改进' AS 状态;

SELECT 
    tgname AS 触发器名称,
    tgenabled AS 是否启用
FROM pg_trigger
WHERE tgname = 'prevent_admin_reduction_trigger';

-- 提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ admin 保护触发器已改进';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新的保护逻辑：';
    RAISE NOTICE '  ✅ 允许清理过期权限（菜单不存在）';
    RAISE NOTICE '  🛡️ 阻止删除有效权限（菜单存在）';
    RAISE NOTICE '';
    RAISE NOTICE '示例：';
    RAISE NOTICE '  - 菜单配置中有 30 个菜单';
    RAISE NOTICE '  - admin 有 47 个权限（包含 17 个过期）';
    RAISE NOTICE '  - 清理为 30 个 → ✅ 允许（都是有效权限）';
    RAISE NOTICE '  - 清理为 25 个 → ❌ 阻止（删除了有效权限）';
    RAISE NOTICE '';
    RAISE NOTICE '未来菜单变化：';
    RAISE NOTICE '  - 添加新菜单 → 自动添加到 admin';
    RAISE NOTICE '  - 删除菜单 → 自动清理（智能保护允许）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

