-- ============================================================================
-- 添加司机账号关联菜单到设置（修正版）
-- 创建日期：2025-11-06
-- ============================================================================

INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) 
SELECT 
    'settings_driver_association',
    'settings',  -- 设置菜单的key
    '司机账号关联',
    '/settings/driver-association',
    'Link',
    903,  -- 在其他设置菜单之后
    ARRAY['settings.manage_roles'],
    true,
    false,
    '关联司机档案与用户账号'
WHERE NOT EXISTS (
    SELECT 1 FROM menu_config WHERE key = 'settings_driver_association'
);

-- 验证
SELECT 
    '✅ 司机账号关联菜单' as 说明,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM menu_config WHERE key = 'settings_driver_association'
        ) THEN '已添加'
        ELSE '添加失败'
    END as 状态;

-- 查看设置菜单下的所有子菜单
SELECT 
    key,
    title,
    url,
    order_index
FROM menu_config
WHERE parent_key = 'settings'
ORDER BY order_index;

