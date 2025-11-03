-- ============================================================================
-- 检查 admin 权限同步状态
-- ============================================================================

-- 1. 查看实际菜单数
SELECT 
    '实际启用的菜单数' AS 项目,
    COUNT(*)::TEXT AS 数量
FROM menu_config
WHERE is_active = true AND is_group = false;

-- 2. 查看 admin 角色的菜单权限数
SELECT 
    'admin 角色权限数' AS 项目,
    array_length(menu_permissions, 1)::TEXT AS 数量
FROM role_permission_templates
WHERE role = 'admin';

-- 3. 对比详细（哪些菜单在admin权限中）
WITH admin_perms AS (
    SELECT unnest(menu_permissions) AS perm_key
    FROM role_permission_templates
    WHERE role = 'admin'
)
SELECT 
    m.key AS 菜单key,
    m.title AS 菜单名称,
    CASE 
        WHEN EXISTS (SELECT 1 FROM admin_perms WHERE perm_key = m.key)
        THEN '✅ 已授权'
        ELSE '❌ 未授权'
    END AS admin权限状态
FROM menu_config m
WHERE m.is_active = true AND m.is_group = false
ORDER BY m.order_index;

-- 4. 检查触发器是否存在
SELECT 
    tgname AS 触发器名称,
    tgenabled AS 是否启用,
    pg_get_triggerdef(oid) AS 触发器定义
FROM pg_trigger
WHERE tgname = 'trigger_auto_sync_admin_on_menu_change';

-- 5. 手动触发同步（以防万一）
SELECT auto_sync_admin_menu_permissions();

-- 6. 再次查看 admin 权限数
SELECT 
    'admin 权限数（同步后）' AS 项目,
    array_length(menu_permissions, 1)::TEXT AS 数量
FROM role_permission_templates
WHERE role = 'admin';

