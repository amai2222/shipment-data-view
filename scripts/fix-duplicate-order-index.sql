-- ============================================================================
-- 修复重复的 order_index
-- ============================================================================
-- 问题：合同管理和系统设置的 order_index 都是 80，导致顺序不确定
-- 解决：调整合同管理为 20（放在业务管理前面）
-- ============================================================================

BEGIN;

-- 调整分组顺序，统一为10的倍数
UPDATE menu_config SET order_index = 10 WHERE key = 'dashboard_group';
UPDATE menu_config SET order_index = 20 WHERE key = 'contracts_group';
UPDATE menu_config SET order_index = 30 WHERE key = 'maintenance_group';
UPDATE menu_config SET order_index = 40 WHERE key = 'business_group';
UPDATE menu_config SET order_index = 50 WHERE key = 'finance_group';
UPDATE menu_config SET order_index = 60 WHERE key = 'audit_group';
UPDATE menu_config SET order_index = 70 WHERE key = 'data_maintenance_group';
UPDATE menu_config SET order_index = 80 WHERE key = 'settings_group';

-- 验证顺序
SELECT 
    title,
    key,
    order_index
FROM menu_config
WHERE is_group = true
ORDER BY order_index;

COMMIT;

-- 提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 菜单分组顺序已调整（统一10的倍数）';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新顺序：';
    RAISE NOTICE '  10 - 数据看板';
    RAISE NOTICE '  20 - 合同管理';
    RAISE NOTICE '  30 - 信息维护';
    RAISE NOTICE '  40 - 业务管理';
    RAISE NOTICE '  50 - 财务管理';
    RAISE NOTICE '  60 - 审核管理';
    RAISE NOTICE '  70 - 数据维护';
    RAISE NOTICE '  80 - 系统设置';
    RAISE NOTICE '';
    RAISE NOTICE '移动单位：10';
    RAISE NOTICE '侧边栏将按此顺序显示';
    RAISE NOTICE '========================================';
END $$;

