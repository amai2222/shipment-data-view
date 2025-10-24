-- ==========================================
-- 修复SQL FROM子句错误
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 修复一键作废功能中的SQL FROM子句错误
-- ==========================================

BEGIN;

-- ============================================================
-- 修复 cancel_payment_status_for_waybills 函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_payment_status_for_waybills(
    p_record_ids UUID[],
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_partner_updated_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以取消付款状态';
    END IF;

    -- 记录操作日志
    RAISE NOTICE '开始取消付款状态: 运单数量=%', array_length(p_record_ids, 1);

    -- 更新 logistics_records 表的付款状态
    UPDATE public.logistics_records
    SET
        payment_status = 'Unpaid',
        payment_completed_at = NULL
    WHERE id = ANY(p_record_ids)
      AND payment_status = 'Paid';  -- 只处理已付款的运单

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '已取消 % 条运单的付款状态', v_updated_count;

    -- 更新 logistics_partner_costs 表中对应运单的合作方（货主除外）的付款状态
    UPDATE public.logistics_partner_costs lpc
    SET 
        payment_status = 'Unpaid',
        payment_completed_at = NULL
    FROM public.logistics_records lr,
         public.partners p
    WHERE lpc.logistics_record_id = lr.id
      AND lpc.partner_id = p.id
      AND lr.id = ANY(p_record_ids)
      AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外，处理NULL值
      AND lpc.payment_status = 'Paid';  -- 只处理已付款的合作方成本

    GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
    RAISE NOTICE '已取消 % 条合作方成本记录的付款状态', v_partner_updated_count;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '付款状态取消成功',
        'updated_waybills', v_updated_count,
        'updated_partner_costs', v_partner_updated_count,
        'record_ids', p_record_ids
    );

    RETURN v_result;
END;
$$;

-- ============================================================
-- 修复 rollback_payment_status_for_waybills 函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.rollback_payment_status_for_waybills(
    p_record_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_waybill_updated_count INTEGER := 0;
    v_partner_updated_count INTEGER := 0;
    v_total_updated INTEGER := 0;
BEGIN
    -- 1. 回滚 logistics_records 表的付款状态
    UPDATE public.logistics_records
    SET 
        payment_status = 'Unpaid',
        payment_completed_at = NULL,
        updated_at = NOW()
    WHERE id = ANY(p_record_ids)
      AND payment_status != 'Unpaid';

    GET DIAGNOSTICS v_waybill_updated_count = ROW_COUNT;
    RAISE NOTICE '已回滚 % 条运单的付款状态', v_waybill_updated_count;

    -- 2. 回滚 logistics_partner_costs 表的付款状态（货主除外）
    UPDATE public.logistics_partner_costs lpc
    SET 
        payment_status = 'Unpaid',
        payment_completed_at = NULL,
        payment_request_id = NULL,
        payment_applied_at = NULL,
        updated_at = NOW()
    FROM public.logistics_records lr,
         public.partners p
    WHERE lpc.logistics_record_id = lr.id
      AND lpc.partner_id = p.id
      AND lr.id = ANY(p_record_ids)
      AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外
      AND lpc.payment_status != 'Unpaid';

    GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
    RAISE NOTICE '已回滚 % 条合作方成本记录的付款状态', v_partner_updated_count;

    v_total_updated := v_waybill_updated_count + v_partner_updated_count;
    RAISE NOTICE '回滚完成: 运单=% + 合作方成本=% = 总计=%', v_waybill_updated_count, v_partner_updated_count, v_total_updated;

    RETURN v_total_updated;
END;
$$;

-- ============================================================
-- 修复 set_payment_status_for_waybills 函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_payment_status_for_waybills(
    p_record_ids UUID[],
    p_payment_status TEXT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_partner_updated_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以更新付款状态';
    END IF;

    -- 记录操作日志
    RAISE NOTICE '开始更新付款状态: 运单数量=%', array_length(p_record_ids, 1);

    -- 更新 logistics_records 表的付款状态
    UPDATE public.logistics_records
    SET 
        payment_status = p_payment_status,
        payment_completed_at = CASE 
            WHEN p_payment_status = 'Paid' THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = ANY(p_record_ids)
      AND payment_status != p_payment_status;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条运单的付款状态', v_updated_count;

    -- 更新 logistics_partner_costs 表中对应运单的合作方（货主除外）的付款状态
    UPDATE public.logistics_partner_costs lpc
    SET 
        payment_status = p_payment_status,
        payment_completed_at = CASE 
            WHEN p_payment_status = 'Paid' THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW()
    FROM public.logistics_records lr,
         public.partners p
    WHERE lpc.logistics_record_id = lr.id
      AND lpc.partner_id = p.id
      AND lr.id = ANY(p_record_ids)
      AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外，处理NULL值
      AND lpc.payment_status != p_payment_status;

    GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条合作方成本记录的付款状态', v_partner_updated_count;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '付款状态更新成功',
        'updated_waybills', v_updated_count,
        'updated_partner_costs', v_partner_updated_count,
        'record_ids', p_record_ids
    );

    RETURN v_result;
END;
$$;

COMMIT;
