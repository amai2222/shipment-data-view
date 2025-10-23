-- ==========================================
-- 付款申请单作废和回滚功能
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 创建付款申请单作废函数和完整的回滚逻辑
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 创建付款申请单作废函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_payment_requests_by_ids(
    p_request_ids TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id TEXT;
    v_affected_count INTEGER := 0;
    v_total_affected INTEGER := 0;
    v_logistics_record_ids UUID[];
    v_waybill_count INTEGER := 0;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以作废付款申请单';
    END IF;

    -- 记录操作开始
    RAISE NOTICE '开始作废付款申请单: 申请单数量=%', array_length(p_request_ids, 1);

    -- 遍历每个申请单ID
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        -- 获取该申请单关联的运单ID
        SELECT logistics_record_ids INTO v_logistics_record_ids
        FROM public.payment_requests
        WHERE request_id = v_request_id
          AND status IN ('Pending', 'Approved');

        IF FOUND AND v_logistics_record_ids IS NOT NULL THEN
            -- 回滚运单状态
            PERFORM public.rollback_payment_status_for_waybills(v_logistics_record_ids);
            
            -- 更新申请单状态为已取消
            UPDATE public.payment_requests
            SET 
                status = 'Cancelled',
                updated_at = NOW(),
                notes = COALESCE(notes, '') || ' [已作废]'
            WHERE request_id = v_request_id
              AND status IN ('Pending', 'Approved');

            GET DIAGNOSTICS v_affected_count = ROW_COUNT;
            v_total_affected := v_total_affected + v_affected_count;
            v_waybill_count := v_waybill_count + array_length(v_logistics_record_ids, 1);
            
            RAISE NOTICE '已作废申请单: % (运单数: %)', v_request_id, array_length(v_logistics_record_ids, 1);
        ELSE
            RAISE NOTICE '申请单 % 不存在或状态不允许作废', v_request_id;
        END IF;
    END LOOP;

    RAISE NOTICE '作废完成: 申请单数=%, 运单数=%', v_total_affected, v_waybill_count;
    RETURN v_waybill_count;
END;
$$;

COMMENT ON FUNCTION public.cancel_payment_requests_by_ids IS '批量作废付款申请单并回滚运单状态';

-- ============================================================
-- 第二步: 创建运单付款状态回滚函数
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
    -- 记录回滚开始
    RAISE NOTICE '开始回滚运单付款状态: 运单数量=%', array_length(p_record_ids, 1);

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
    FROM public.logistics_records lr
    JOIN public.partners p ON lpc.partner_id = p.id
    WHERE lpc.logistics_record_id = lr.id
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

COMMENT ON FUNCTION public.rollback_payment_status_for_waybills IS '回滚运单付款状态到未付款状态';

-- ============================================================
-- 第三步: 创建完整的付款申请单作废函数（带详细回滚）
-- ============================================================

CREATE OR REPLACE FUNCTION public.void_payment_request_with_rollback(
    p_request_id TEXT,
    p_void_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_logistics_record_ids UUID[];
    v_waybill_count INTEGER := 0;
    v_partner_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以作废付款申请单';
    END IF;

    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.payment_requests
    WHERE request_id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '付款申请单不存在: %', p_request_id;
    END IF;

    -- 检查状态
    IF v_request.status = 'Cancelled' THEN
        RAISE EXCEPTION '该申请单已经作废';
    END IF;

    IF v_request.status = 'Paid' THEN
        RAISE EXCEPTION '已付款的申请单不能作废，请先回滚付款状态';
    END IF;

    -- 获取关联的运单ID
    v_logistics_record_ids := v_request.logistics_record_ids;

    -- 执行回滚
    IF v_logistics_record_ids IS NOT NULL AND array_length(v_logistics_record_ids, 1) > 0 THEN
        v_waybill_count := public.rollback_payment_status_for_waybills(v_logistics_record_ids);
    END IF;

    -- 更新申请单状态
    UPDATE public.payment_requests
    SET 
        status = 'Cancelled',
        updated_at = NOW(),
        notes = COALESCE(notes, '') || ' [已作废: ' || COALESCE(p_void_reason, '手动作废') || ']'
    WHERE request_id = p_request_id;

    -- 删除付款申请明细（如果存在）
    DELETE FROM public.partner_payment_items
    WHERE payment_request_id = v_request.id;

    GET DIAGNOSTICS v_partner_count = ROW_COUNT;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '付款申请单已作废并回滚',
        'request_id', p_request_id,
        'waybill_count', v_waybill_count,
        'partner_item_count', v_partner_count,
        'void_reason', p_void_reason
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.void_payment_request_with_rollback IS '作废付款申请单并完整回滚所有相关状态';

-- ============================================================
-- 第四步: 创建状态检查函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_payment_rollback_eligibility(
    p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id TEXT;
    v_request record;
    v_eligible_count INTEGER := 0;
    v_paid_count INTEGER := 0;
    v_cancelled_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查每个申请单的状态
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        SELECT * INTO v_request
        FROM public.payment_requests
        WHERE request_id = v_request_id;

        IF FOUND THEN
            CASE v_request.status
                WHEN 'Pending', 'Approved' THEN
                    v_eligible_count := v_eligible_count + 1;
                WHEN 'Paid' THEN
                    v_paid_count := v_paid_count + 1;
                WHEN 'Cancelled' THEN
                    v_cancelled_count := v_cancelled_count + 1;
            END CASE;
        END IF;
    END LOOP;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'total_requests', array_length(p_request_ids, 1),
        'eligible_for_cancel', v_eligible_count,
        'already_paid', v_paid_count,
        'already_cancelled', v_cancelled_count,
        'can_proceed', v_eligible_count > 0
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_payment_rollback_eligibility IS '检查付款申请单作废的资格';

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '付款申请单作废和回滚功能创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增函数:';
    RAISE NOTICE '  1. cancel_payment_requests_by_ids() - 批量作废付款申请单';
    RAISE NOTICE '  2. rollback_payment_status_for_waybills() - 回滚运单付款状态';
    RAISE NOTICE '  3. void_payment_request_with_rollback() - 单个申请单作废';
    RAISE NOTICE '  4. check_payment_rollback_eligibility() - 检查作废资格';
    RAISE NOTICE '';
    RAISE NOTICE '回滚逻辑:';
    RAISE NOTICE '  - 运单付款状态: Paid → Unpaid';
    RAISE NOTICE '  - 合作方成本状态: Paid → Unpaid (货主除外)';
    RAISE NOTICE '  - 申请单状态: Pending/Approved → Cancelled';
    RAISE NOTICE '  - 清理关联数据: partner_payment_items';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
