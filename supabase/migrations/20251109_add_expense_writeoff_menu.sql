-- ============================================================================
-- 添加费用冲销菜单项
-- 创建时间: 2025-11-09
-- 功能: 在内部车辆管理菜单组中添加费用冲销菜单项
-- ============================================================================

-- 检查并添加费用冲销菜单项（PC端）
DO $$
DECLARE
    v_parent_key TEXT;
    v_max_order INTEGER;
BEGIN
    -- 查找内部车辆管理分组的key
    SELECT key INTO v_parent_key
    FROM menu_config
    WHERE title = '内部车辆管理' AND is_group = true
    LIMIT 1;
    
    IF v_parent_key IS NULL THEN
        RAISE NOTICE '⚠️ 未找到内部车辆管理菜单分组，跳过菜单添加';
        RETURN;
    END IF;
    
    -- 检查菜单项是否已存在
    IF EXISTS (
        SELECT 1 FROM menu_config 
        WHERE key = 'internal_expense_writeoff'
    ) THEN
        RAISE NOTICE '⚠️ 费用冲销菜单项已存在';
        RETURN;
    END IF;
    
    -- 获取当前最大order_index
    SELECT COALESCE(MAX(order_index), 500) INTO v_max_order
    FROM menu_config
    WHERE parent_key = v_parent_key;
    
    -- 添加费用冲销菜单项
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
        'internal_expense_writeoff',
        v_parent_key,
        '费用冲销管理',
        '/internal/expense-writeoff',
        'Calculator',
        v_max_order + 1,
        ARRAY['internal.expense_review'],
        true,
        false,
        '查看和管理所有司机的费用冲销记录'
    );
    
    RAISE NOTICE '✅ 已添加费用冲销菜单项';
END $$;

COMMENT ON TABLE menu_config IS '菜单配置表';

