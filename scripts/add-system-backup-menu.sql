-- ============================================================================
-- 添加系统备份菜单
-- ============================================================================
-- 功能：在设置菜单组下添加"系统备份"菜单项
-- ============================================================================

BEGIN;

-- 添加系统备份菜单
INSERT INTO public.menu_config (
    key, 
    parent_key, 
    title, 
    url, 
    icon, 
    order_index, 
    is_group, 
    is_active, 
    required_permissions
) VALUES (
    'settings.backup',
    'settings_group',
    '系统备份',
    '/settings/backup',
    'Database',
    88,  -- 排在菜单配置后面
    false,
    true,
    ARRAY['settings.backup']
)
ON CONFLICT (key) DO UPDATE SET
    title = EXCLUDED.title,
    url = EXCLUDED.url,
    icon = EXCLUDED.icon,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    required_permissions = EXCLUDED.required_permissions;

COMMIT;

-- 验证
SELECT 
    '✅ 系统备份菜单已添加' AS status;

-- 查看设置分组下的所有菜单
SELECT 
    title,
    url,
    order_index,
    is_active
FROM menu_config
WHERE parent_key = 'settings_group'
ORDER BY order_index;

-- 提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 系统备份菜单已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '菜单信息：';
    RAISE NOTICE '  - 标题: 系统备份';
    RAISE NOTICE '  - URL: /settings/backup';
    RAISE NOTICE '  - 图标: Database';
    RAISE NOTICE '  - 所需权限: settings.backup';
    RAISE NOTICE '';
    RAISE NOTICE '功能：';
    RAISE NOTICE '  - 支持备份为 JSON 格式';
    RAISE NOTICE '  - 支持备份为 SQL 格式';
    RAISE NOTICE '  - 可选择备份的表';
    RAISE NOTICE '  - 自动生成带时间戳的文件名';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '  1. 刷新前端页面';
    RAISE NOTICE '  2. 在"设置"菜单下查看"系统备份"';
    RAISE NOTICE '  3. admin用户自动拥有访问权限';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;


