-- ============================================================================
-- 清理 admin 角色的过期权限
-- ============================================================================
-- 问题：admin 有 47 个权限，但实际只有 30 个菜单
-- 解决：只保留实际存在的菜单权限
-- ============================================================================

BEGIN;

-- 1. 查看哪些权限是过期的
WITH 
  admin_perms AS (
    SELECT unnest(menu_permissions) AS perm_key
    FROM role_permission_templates
    WHERE role = 'admin'
  ),
  valid_menus AS (
    SELECT key
    FROM menu_config
    WHERE is_active = true AND is_group = false
  )
SELECT 
    ap.perm_key AS 权限key,
    CASE 
        WHEN EXISTS (SELECT 1 FROM valid_menus WHERE key = ap.perm_key)
        THEN '✅ 有效'
        ELSE '❌ 过期（菜单不存在）'
    END AS 状态
FROM admin_perms ap
ORDER BY 状态, ap.perm_key;

-- 2. 清理过期权限，只保留实际存在的菜单
UPDATE role_permission_templates
SET menu_permissions = (
    SELECT array_agg(m.key ORDER BY m.order_index)
    FROM menu_config m
    WHERE m.is_active = true 
      AND m.is_group = false
)
WHERE role = 'admin';

COMMIT;

-- 3. 验证结果
SELECT 
    '清理后的状态' AS 标题;

SELECT 
    '实际菜单数' AS 项目,
    COUNT(*)::TEXT AS 数量
FROM menu_config
WHERE is_active = true AND is_group = false

UNION ALL

SELECT 
    'admin 权限数' AS 项目,
    array_length(menu_permissions, 1)::TEXT AS 数量
FROM role_permission_templates
WHERE role = 'admin';

-- 提示
DO $$
DECLARE
    v_menu_count INTEGER;
    v_admin_perm_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_menu_count
    FROM menu_config
    WHERE is_active = true AND is_group = false;
    
    SELECT array_length(menu_permissions, 1) INTO v_admin_perm_count
    FROM role_permission_templates
    WHERE role = 'admin';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ admin 权限已清理';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '实际菜单数: %', v_menu_count;
    RAISE NOTICE 'admin 权限数: %', v_admin_perm_count;
    RAISE NOTICE '';
    
    IF v_menu_count = v_admin_perm_count THEN
        RAISE NOTICE '✅ 完全同步！';
    ELSE
        RAISE WARNING '⚠️ 仍有差异，请检查';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '现在 admin 只拥有实际存在的菜单权限';
    RAISE NOTICE '========================================';
END $$;

