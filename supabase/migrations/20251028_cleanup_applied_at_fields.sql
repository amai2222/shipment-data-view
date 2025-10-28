-- ============================================================
-- 清空 logistics_partner_costs 表中的申请时间字段
-- ============================================================
-- 目的：将所有记录的 invoice_applied_at 和 payment_applied_at 设为 NULL
-- 用途：数据清理，重置申请时间
-- ============================================================

BEGIN;

-- 统计清理前的数据
DO $$
DECLARE
    v_total_records INTEGER;
    v_has_invoice_applied INTEGER;
    v_has_payment_applied INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_records
    FROM public.logistics_partner_costs;
    
    SELECT COUNT(*) INTO v_has_invoice_applied
    FROM public.logistics_partner_costs
    WHERE invoice_applied_at IS NOT NULL;
    
    SELECT COUNT(*) INTO v_has_payment_applied
    FROM public.logistics_partner_costs
    WHERE payment_applied_at IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 清理前数据统计';
    RAISE NOTICE '========================================';
    RAISE NOTICE '总记录数: %', v_total_records;
    RAISE NOTICE '有 invoice_applied_at 的记录: %', v_has_invoice_applied;
    RAISE NOTICE '有 payment_applied_at 的记录: %', v_has_payment_applied;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- 清空 invoice_applied_at 和 payment_applied_at 字段
UPDATE public.logistics_partner_costs
SET 
    invoice_applied_at = NULL,
    payment_applied_at = NULL
WHERE invoice_applied_at IS NOT NULL 
   OR payment_applied_at IS NOT NULL;

-- 验证清理结果
DO $$
DECLARE
    v_remaining_invoice INTEGER;
    v_remaining_payment INTEGER;
    v_updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    SELECT COUNT(*) INTO v_remaining_invoice
    FROM public.logistics_partner_costs
    WHERE invoice_applied_at IS NOT NULL;
    
    SELECT COUNT(*) INTO v_remaining_payment
    FROM public.logistics_partner_costs
    WHERE payment_applied_at IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 清理完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '更新的记录数: %', v_updated_count;
    RAISE NOTICE '';
    
    IF v_remaining_invoice = 0 AND v_remaining_payment = 0 THEN
        RAISE NOTICE '✓ 所有 invoice_applied_at 已清空';
        RAISE NOTICE '✓ 所有 payment_applied_at 已清空';
        RAISE NOTICE '✓ 数据清理成功';
    ELSE
        RAISE WARNING '仍有未清空的记录：';
        RAISE WARNING '  invoice_applied_at: % 条', v_remaining_invoice;
        RAISE WARNING '  payment_applied_at: % 条', v_remaining_payment;
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✨ 字段清理已完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '清理的字段：';
    RAISE NOTICE '  - invoice_applied_at → NULL';
    RAISE NOTICE '  - payment_applied_at → NULL';
    RAISE NOTICE '';
    RAISE NOTICE '影响的表：logistics_partner_costs';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

