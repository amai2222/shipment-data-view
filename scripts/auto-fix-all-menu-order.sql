-- ============================================================================
-- 自动修正所有菜单的排序值
-- ============================================================================
-- 规则：
--   - 分组：10, 20, 30, 40, 50, 60, 70, 80
--   - 分组内菜单：分组值+1, +2, +3, +4...
-- 例如：财务管理(50) → 对账管理(51), 付款开票(52), 付款申请(53)
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：修正分组顺序（10的倍数）
-- ==========================================

UPDATE menu_config SET order_index = 10 WHERE key = 'dashboard_group';
UPDATE menu_config SET order_index = 20 WHERE key = 'contracts_group';
UPDATE menu_config SET order_index = 30 WHERE key = 'maintenance_group';
UPDATE menu_config SET order_index = 40 WHERE key = 'business_group';
UPDATE menu_config SET order_index = 50 WHERE key = 'finance_group';
UPDATE menu_config SET order_index = 60 WHERE key = 'audit_group';
UPDATE menu_config SET order_index = 70 WHERE key = 'data_maintenance_group';
UPDATE menu_config SET order_index = 80 WHERE key = 'settings_group';

-- ==========================================
-- 第二步：自动修正各分组下的菜单项序号
-- ==========================================

-- dashboard_group (10) → 11, 12, 13, 14
UPDATE menu_config SET order_index = 11 WHERE key = 'dashboard.transport';
UPDATE menu_config SET order_index = 12 WHERE key = 'dashboard.financial';
UPDATE menu_config SET order_index = 13 WHERE key = 'dashboard.project';
UPDATE menu_config SET order_index = 14 WHERE key = 'dashboard.shipper';

-- contracts_group (20) → 21
UPDATE menu_config SET order_index = 21 WHERE key = 'contracts.list';

-- maintenance_group (30) → 31, 32, 33, 34, 35, 36
UPDATE menu_config SET order_index = 31 WHERE key = 'maintenance.projects';
UPDATE menu_config SET order_index = 32 WHERE key = 'maintenance.drivers';
UPDATE menu_config SET order_index = 33 WHERE key = 'maintenance.locations';
UPDATE menu_config SET order_index = 34 WHERE key = 'maintenance.locations_enhanced';
UPDATE menu_config SET order_index = 35 WHERE key = 'maintenance.partners';
UPDATE menu_config SET order_index = 36 WHERE key = 'maintenance.partners_hierarchy';

-- business_group (40) → 41, 42, 43, 44
UPDATE menu_config SET order_index = 41 WHERE key = 'business.entry';
UPDATE menu_config SET order_index = 42 WHERE key = 'business.scale';
UPDATE menu_config SET order_index = 43 WHERE key = 'business.invoice_request';
UPDATE menu_config SET order_index = 44 WHERE key = 'business.payment_request';

-- finance_group (50) → 51, 52, 53, 54
UPDATE menu_config SET order_index = 51 WHERE key = 'finance.reconciliation';
UPDATE menu_config SET order_index = 52 WHERE key = 'finance.payment_invoice';
UPDATE menu_config SET order_index = 53 WHERE key = 'finance.payment_requests';
UPDATE menu_config SET order_index = 54 WHERE key = 'finance.invoice_request_management';

-- audit_group (60) → 61, 62
UPDATE menu_config SET order_index = 61 WHERE key = 'audit.invoice';
UPDATE menu_config SET order_index = 62 WHERE key = 'audit.payment';

-- data_maintenance_group (70) → 71, 72
UPDATE menu_config SET order_index = 71 WHERE key = 'data_maintenance.waybill';
UPDATE menu_config SET order_index = 72 WHERE key = 'data_maintenance.waybill_enhanced';

-- settings_group (80) → 81, 82, 83, 84, 85, 86, 87, 88
UPDATE menu_config SET order_index = 81 WHERE key = 'settings.users';
UPDATE menu_config SET order_index = 82 WHERE key = 'settings.permissions';
UPDATE menu_config SET order_index = 83 WHERE key = 'settings.contract_permissions';
UPDATE menu_config SET order_index = 84 WHERE key = 'settings.role_templates';
UPDATE menu_config SET order_index = 85 WHERE key = 'settings.integrated';
UPDATE menu_config SET order_index = 86 WHERE key = 'settings.audit_logs';
UPDATE menu_config SET order_index = 87 WHERE key = 'settings.menu_config';
UPDATE menu_config SET order_index = 88 WHERE key = 'settings.backup';

COMMIT;

-- ==========================================
-- 验证结果
-- ==========================================

-- 查看分组顺序
SELECT 
    '======== 分组顺序 ========' AS info;

SELECT 
    order_index AS 序号,
    title AS 标题,
    key
FROM menu_config
WHERE is_group = true
ORDER BY order_index;

-- 查看各分组下的菜单
SELECT 
    '======== 各分组菜单顺序 ========' AS info;

SELECT 
    (SELECT title FROM menu_config WHERE key = m.parent_key) AS 所属分组,
    m.order_index AS 序号,
    m.title AS 菜单标题,
    m.key
FROM menu_config m
WHERE m.is_group = false
ORDER BY m.parent_key, m.order_index;

-- 提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 所有菜单顺序已自动修正';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '分组规则：10, 20, 30...（10的倍数）';
    RAISE NOTICE '菜单规则：分组值+1, +2, +3...';
    RAISE NOTICE '';
    RAISE NOTICE '示例：';
    RAISE NOTICE '  财务管理(50)';
    RAISE NOTICE '    → 对账管理(51)';
    RAISE NOTICE '    → 付款开票(52)';
    RAISE NOTICE '    → 付款申请列表(53)';
    RAISE NOTICE '    → 开票申请管理(54)';
    RAISE NOTICE '';
    RAISE NOTICE '侧边栏和菜单配置页面都将按此顺序显示';
    RAISE NOTICE '========================================';
END $$;

