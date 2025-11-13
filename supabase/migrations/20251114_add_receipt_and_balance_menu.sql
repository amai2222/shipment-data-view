-- ============================================================================
-- 添加收款报表和货主余额菜单
-- ============================================================================
-- 创建日期：2025-11-14
-- 功能：在财务管理分组中添加"收款报表"和"货主余额"菜单项
-- ============================================================================

BEGIN;

-- 检查并添加"收款报表"菜单
INSERT INTO public.menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    is_group,
    is_active,
    required_permissions,
    description
)
SELECT 
    'finance.receipt_report',
    'finance_group',
    '收款报表',
    '/finance/receipt-report',
    'TrendingUp',
    96,  -- 放在"财务付款"之后
    false,
    true,
    ARRAY['finance.receipt_report'],
    '查看收款统计报表和明细记录'
WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_config WHERE key = 'finance.receipt_report'
);

-- 检查并添加"货主余额"菜单
INSERT INTO public.menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    is_group,
    is_active,
    required_permissions,
    description
)
SELECT 
    'finance.partner_balance',
    'finance_group',
    '货主余额',
    '/partner-balance',
    'DollarSign',
    97,  -- 放在"收款报表"之后
    false,
    true,
    ARRAY['finance.partner_balance'],
    '查看和管理货主账户余额及交易记录'
WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_config WHERE key = 'finance.partner_balance'
);

-- 更新"财务收款"菜单标题（从"付款与开票"改为"财务收款"）
UPDATE public.menu_config
SET title = '财务收款',
    description = '对已开票申请单进行收款、退款、对账操作'
WHERE key = 'finance.payment_invoice'
  AND title != '财务收款';

-- 自动同步管理员权限（触发自动同步函数）
DO $$
BEGIN
    PERFORM auto_sync_admin_menu_permissions();
    RAISE NOTICE '✅ 管理员菜单权限已自动同步';
END $$;

COMMIT;

-- 验证结果
DO $$
DECLARE
    v_receipt_report_count INTEGER;
    v_partner_balance_count INTEGER;
    v_payment_invoice_title TEXT;
BEGIN
    SELECT COUNT(*) INTO v_receipt_report_count
    FROM public.menu_config
    WHERE key = 'finance.receipt_report';
    
    SELECT COUNT(*) INTO v_partner_balance_count
    FROM public.menu_config
    WHERE key = 'finance.partner_balance';
    
    SELECT title INTO v_payment_invoice_title
    FROM public.menu_config
    WHERE key = 'finance.payment_invoice';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 菜单添加完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '收款报表菜单: % (期望: 1)', v_receipt_report_count;
    RAISE NOTICE '货主余额菜单: % (期望: 1)', v_partner_balance_count;
    RAISE NOTICE '财务收款菜单标题: %', v_payment_invoice_title;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

