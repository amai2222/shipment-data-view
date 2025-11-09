-- ============================================================================
-- 添加车队信息维护菜单项
-- 创建时间: 2025-11-09
-- 功能: 在信息维护菜单组中添加车队信息维护菜单项
-- ============================================================================

-- 检查并添加车队信息维护菜单项（PC端）
DO $$
DECLARE
    v_parent_key TEXT;
    v_max_order INTEGER;
BEGIN
    -- 查找信息维护分组的key
    SELECT key INTO v_parent_key
    FROM menu_config
    WHERE title = '信息维护' AND is_group = true
    LIMIT 1;
    
    IF v_parent_key IS NULL THEN
        RAISE NOTICE '⚠️ 未找到信息维护菜单分组，跳过菜单添加';
        RETURN;
    END IF;
    
    -- 检查菜单项是否已存在
    IF EXISTS (
        SELECT 1 FROM menu_config 
        WHERE key = 'maintenance.fleet'
    ) THEN
        RAISE NOTICE '⚠️ 车队信息维护菜单项已存在';
        RETURN;
    END IF;
    
    -- 获取当前最大order_index
    SELECT COALESCE(MAX(order_index), 30) INTO v_max_order
    FROM menu_config
    WHERE parent_key = v_parent_key;
    
    -- 添加车队信息维护菜单项
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
    ) VALUES (
        'maintenance.fleet',
        v_parent_key,
        '车队信息维护',
        '/fleet-management',
        'Users',
        v_max_order + 1,
        ARRAY['maintenance.fleet'],
        true,
        false,
        '管理车队长和司机的关系，配置司机的项目线路'
    );
    
    RAISE NOTICE '✅ 已添加车队信息维护菜单项';
END $$;

COMMENT ON TABLE menu_config IS '菜单配置表';

