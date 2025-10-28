-- ============================================================
-- 清理 logistics_partner_costs 表中的无效引用
-- ============================================================
-- 目的：清理指向不存在记录的 invoice_request_id 和 payment_request_id
-- 可以安全执行多次，不会影响正常数据
-- ============================================================

BEGIN;

-- 统计需要清理的记录数
DO $$
DECLARE
    v_invalid_invoice_count INTEGER;
    v_invalid_payment_count INTEGER;
BEGIN
    -- 统计无效的 invoice_request_id
    SELECT COUNT(*) INTO v_invalid_invoice_count
    FROM public.logistics_partner_costs
    WHERE invoice_request_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.invoice_requests 
        WHERE id = logistics_partner_costs.invoice_request_id
      );
    
    -- 统计无效的 payment_request_id
    SELECT COUNT(*) INTO v_invalid_payment_count
    FROM public.logistics_partner_costs
    WHERE payment_request_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_requests 
        WHERE id = logistics_partner_costs.payment_request_id
      );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 数据清理前统计';
    RAISE NOTICE '========================================';
    RAISE NOTICE '无效的 invoice_request_id 引用数: %', v_invalid_invoice_count;
    RAISE NOTICE '无效的 payment_request_id 引用数: %', v_invalid_payment_count;
    RAISE NOTICE '总计需要清理: % 条记录', v_invalid_invoice_count + v_invalid_payment_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- 1. 清理无效的 invoice_request_id 引用
UPDATE public.logistics_partner_costs
SET invoice_request_id = NULL
WHERE invoice_request_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_requests 
    WHERE id = logistics_partner_costs.invoice_request_id
  );

-- 2. 清理无效的 payment_request_id 引用
UPDATE public.logistics_partner_costs
SET payment_request_id = NULL
WHERE payment_request_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_requests 
    WHERE id = logistics_partner_costs.payment_request_id
  );

-- 验证清理结果
DO $$
DECLARE
    v_remaining_invalid_invoice INTEGER;
    v_remaining_invalid_payment INTEGER;
BEGIN
    -- 检查是否还有无效引用
    SELECT COUNT(*) INTO v_remaining_invalid_invoice
    FROM public.logistics_partner_costs
    WHERE invoice_request_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.invoice_requests 
        WHERE id = logistics_partner_costs.invoice_request_id
      );
    
    SELECT COUNT(*) INTO v_remaining_invalid_payment
    FROM public.logistics_partner_costs
    WHERE payment_request_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_requests 
        WHERE id = logistics_partner_costs.payment_request_id
      );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 数据清理完成';
    RAISE NOTICE '========================================';
    
    IF v_remaining_invalid_invoice = 0 AND v_remaining_invalid_payment = 0 THEN
        RAISE NOTICE '✓ 所有无效引用已清理完毕';
        RAISE NOTICE '✓ 数据完整性已恢复';
    ELSE
        RAISE WARNING '仍有无效引用：invoice_request_id: %, payment_request_id: %', 
                      v_remaining_invalid_invoice, v_remaining_invalid_payment;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📌 下一步：';
    RAISE NOTICE '运行 20251028_fix_invoice_request_id_foreign_key.sql';
    RAISE NOTICE '添加外键约束以防止将来出现无效引用';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- 额外的数据统计信息
DO $$
DECLARE
    v_total_costs INTEGER;
    v_with_invoice_request INTEGER;
    v_with_payment_request INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_costs
    FROM public.logistics_partner_costs;
    
    SELECT COUNT(*) INTO v_with_invoice_request
    FROM public.logistics_partner_costs
    WHERE invoice_request_id IS NOT NULL;
    
    SELECT COUNT(*) INTO v_with_payment_request
    FROM public.logistics_partner_costs
    WHERE payment_request_id IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📈 当前数据统计';
    RAISE NOTICE '========================================';
    RAISE NOTICE '合作方成本记录总数: %', v_total_costs;
    RAISE NOTICE '关联开票申请的记录数: % (%.1f%%)', v_with_invoice_request, 
                 (v_with_invoice_request::NUMERIC / NULLIF(v_total_costs, 0) * 100);
    RAISE NOTICE '关联付款申请的记录数: % (%.1f%%)', v_with_payment_request,
                 (v_with_payment_request::NUMERIC / NULLIF(v_total_costs, 0) * 100);
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

