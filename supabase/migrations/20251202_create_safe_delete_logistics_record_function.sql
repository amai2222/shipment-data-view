-- ============================================================================
-- 创建安全删除单条运单的函数
-- 日期：2025-12-02
-- 问题：直接删除 logistics_records 会因外键约束（dispatch_orders）报 409 冲突
-- 解决：创建数据库函数，确保按正确顺序删除所有关联数据
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_single_logistics_record(
    p_record_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_auto_number TEXT;
    v_invoice_status TEXT;
    v_payment_status TEXT;
    v_receipt_status TEXT;
    v_has_payment_request BOOLEAN := false;
    v_has_invoice_request BOOLEAN := false;
    v_deleted_dispatch_count INTEGER := 0;
    v_deleted_cost_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 获取运单信息（包括状态）
    SELECT 
        auto_number,
        COALESCE(invoice_status, 'Uninvoiced'),
        COALESCE(payment_status, 'Unpaid'),
        COALESCE(receipt_status, 'Unreceived')
    INTO 
        v_auto_number,
        v_invoice_status,
        v_payment_status,
        v_receipt_status
    FROM public.logistics_records
    WHERE id = p_record_id;
    
    -- 如果记录不存在，返回错误
    IF v_auto_number IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '运单记录不存在',
            'record_id', p_record_id
        );
    END IF;
    
    -- ========== 数据保护检查 ==========
    -- ✅ 检查1：开票状态 - 只能删除未开票的运单
    IF v_invoice_status NOT IN ('Uninvoiced', '') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('无法删除运单 %s：该运单已开票（状态：%s）。请先取消开票后再删除。', v_auto_number, v_invoice_status),
            'record_id', p_record_id,
            'auto_number', v_auto_number,
            'invoice_status', v_invoice_status
        );
    END IF;
    
    -- ✅ 检查2：付款状态 - 只能删除未付款的运单
    IF v_payment_status NOT IN ('Unpaid', '') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('无法删除运单 %s：该运单已付款（状态：%s）。请先取消付款后再删除。', v_auto_number, v_payment_status),
            'record_id', p_record_id,
            'auto_number', v_auto_number,
            'payment_status', v_payment_status
        );
    END IF;
    
    -- ✅ 检查3：收款状态 - 只能删除未收款的运单
    IF v_receipt_status NOT IN ('Unreceived', '') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('无法删除运单 %s：该运单已收款（状态：%s）。请先取消收款后再删除。', v_auto_number, v_receipt_status),
            'record_id', p_record_id,
            'auto_number', v_auto_number,
            'receipt_status', v_receipt_status
        );
    END IF;
    
    -- ✅ 检查4：是否关联了未完成的付款申请
    SELECT EXISTS(
        SELECT 1
        FROM public.payment_requests pr
        WHERE p_record_id = ANY(pr.logistics_record_ids)
          AND pr.status IN ('Pending', 'Approved')
    ) INTO v_has_payment_request;
    
    IF v_has_payment_request THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('无法删除运单 %s：该运单关联了未完成的付款申请。请先完成或取消付款申请后再删除。', v_auto_number),
            'record_id', p_record_id,
            'auto_number', v_auto_number
        );
    END IF;
    
    -- ✅ 检查5：是否关联了未完成的发票申请
    SELECT EXISTS(
        SELECT 1
        FROM public.invoice_requests ir
        JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = p_record_id
          AND ir.status IN ('Pending', 'Approved')
    ) INTO v_has_invoice_request;
    
    IF v_has_invoice_request THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('无法删除运单 %s：该运单关联了未完成的发票申请。请先完成或取消发票申请后再删除。', v_auto_number),
            'record_id', p_record_id,
            'auto_number', v_auto_number
        );
    END IF;
    
    -- 第1步：删除关联的 dispatch_orders 记录（如果有的话）
    -- ✅ 注意：只有通过派单系统创建的运单才有 dispatch_orders 记录
    -- 外部运单（手动创建、导入等）可能没有此记录，这是正常的
    WITH deleted_dispatch AS (
        DELETE FROM public.dispatch_orders
        WHERE logistics_record_id = p_record_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_dispatch_count FROM deleted_dispatch;
    
    -- 第2步：删除关联的 logistics_partner_costs 记录
    WITH deleted_costs AS (
        DELETE FROM public.logistics_partner_costs
        WHERE logistics_record_id = p_record_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_cost_count FROM deleted_costs;
    
    -- 第3步：删除运单记录本身
    DELETE FROM public.logistics_records
    WHERE id = p_record_id;
    
    -- 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功删除运单 %s', v_auto_number),
        'auto_number', v_auto_number,
        'deleted_dispatch_count', v_deleted_dispatch_count,
        'deleted_cost_count', v_deleted_cost_count
    );
    
EXCEPTION WHEN OTHERS THEN
    -- 错误处理
    RETURN jsonb_build_object(
        'success', false,
        'error', '删除运单时发生错误: ' || SQLERRM,
        'record_id', p_record_id,
        'auto_number', COALESCE(v_auto_number, '未知')
    );
END;
$function$;

COMMENT ON FUNCTION public.delete_single_logistics_record IS '安全删除单条运单记录（包含数据保护：只能删除未开票、未付款、未收款的运单，以及所有关联数据：派单、成本等）';

-- 验证
DO $$
DECLARE
    test_result JSONB;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 安全删除运单函数已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '函数功能：';
    RAISE NOTICE '  1. 数据保护检查（开票、付款、收款状态，以及关联申请）';
    RAISE NOTICE '  2. 删除关联的 dispatch_orders 记录（如果有，仅内部派单生成的运单才有）';
    RAISE NOTICE '  3. 删除关联的 logistics_partner_costs 记录';
    RAISE NOTICE '  4. 删除 logistics_records 记录';
    RAISE NOTICE '';
    RAISE NOTICE '数据保护规则：';
    RAISE NOTICE '  ✅ 只能删除未开票（Uninvoiced）的运单';
    RAISE NOTICE '  ✅ 只能删除未付款（Unpaid）的运单';
    RAISE NOTICE '  ✅ 只能删除未收款（Unreceived）的运单';
    RAISE NOTICE '  ✅ 不能删除关联了未完成付款申请的运单';
    RAISE NOTICE '  ✅ 不能删除关联了未完成发票申请的运单';
    RAISE NOTICE '';
    RAISE NOTICE '说明：';
    RAISE NOTICE '  - 内部运单：通过派单系统创建，有 dispatch_orders 记录';
    RAISE NOTICE '  - 外部运单：手动创建或导入，没有 dispatch_orders 记录（正常情况）';
    RAISE NOTICE '';
    RAISE NOTICE '使用方法：';
    RAISE NOTICE '  SELECT public.delete_single_logistics_record(''记录ID'');';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

