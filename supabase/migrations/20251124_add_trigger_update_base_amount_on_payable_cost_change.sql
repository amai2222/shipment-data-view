-- ============================================================================
-- 创建触发器：当运单的司机应收（payable_cost）变化时，自动更新
-- logistics_partner_costs 表中的 base_amount 值
-- 创建日期：2025-11-24
-- ============================================================================

-- ============================================================================
-- 创建触发器函数：更新 base_amount
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_update_base_amount_on_payable_cost_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_protected_count INTEGER := 0;
BEGIN
    -- 只在 payable_cost 改变时触发
    IF OLD.payable_cost IS NOT DISTINCT FROM NEW.payable_cost THEN
        RETURN NEW;  -- 司机应收没变，不处理
    END IF;
    
    RAISE NOTICE '📌 司机应收改变：¥% → ¥%，开始更新 base_amount', OLD.payable_cost, NEW.payable_cost;
    
    -- 更新所有相关合作方成本记录的 base_amount
    -- 注意：这里更新所有记录，包括手工修改的，因为 base_amount 应该始终等于 payable_cost
    UPDATE public.logistics_partner_costs
    SET base_amount = NEW.payable_cost,
        updated_at = NOW()
    WHERE logistics_record_id = NEW.id
      AND base_amount IS DISTINCT FROM NEW.payable_cost;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count > 0 THEN
        RAISE NOTICE '✅ 已更新 % 条合作方成本记录的 base_amount', v_updated_count;
    ELSE
        RAISE NOTICE 'ℹ️  没有需要更新的记录（base_amount 已是最新值）';
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_update_base_amount_on_payable_cost_change IS '触发器函数：当运单的司机应收（payable_cost）变化时，自动更新 logistics_partner_costs 表中的 base_amount 值';

-- ============================================================================
-- 创建触发器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_base_amount_on_payable_cost_change ON public.logistics_records;

CREATE TRIGGER trigger_update_base_amount_on_payable_cost_change
    AFTER UPDATE OF payable_cost ON public.logistics_records
    FOR EACH ROW
    WHEN (OLD.payable_cost IS DISTINCT FROM NEW.payable_cost)  -- 只在 payable_cost 改变时触发
    EXECUTE FUNCTION public.auto_update_base_amount_on_payable_cost_change();

COMMENT ON TRIGGER trigger_update_base_amount_on_payable_cost_change ON public.logistics_records IS '当运单的司机应收（payable_cost）变化时，自动更新 logistics_partner_costs 表中的 base_amount 值';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ base_amount 自动更新触发器已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '触发条件：';
    RAISE NOTICE '  • logistics_records.payable_cost 改变';
    RAISE NOTICE '';
    RAISE NOTICE '触发动作：';
    RAISE NOTICE '  • 更新所有相关 logistics_partner_costs.base_amount = payable_cost';
    RAISE NOTICE '  • 包括手工修改的记录（base_amount 应该始终等于 payable_cost）';
    RAISE NOTICE '';
    RAISE NOTICE '现在：';
    RAISE NOTICE '  • 修改司机应收 → 自动更新 base_amount ✅';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

