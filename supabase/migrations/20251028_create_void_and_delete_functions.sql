-- ============================================================
-- 创建作废并删除申请单的函数
-- ============================================================
-- 功能说明：
-- 1. void_invoice_request：作废开票申请（不删除记录，只回滚状态）
-- 2. void_and_delete_invoice_requests：作废并删除开票申请记录
-- 3. void_payment_requests_by_ids：作废付款申请（不删除记录，只回滚状态）
-- 4. void_and_delete_payment_requests：作废并删除付款申请记录
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 开票申请 - 作废并删除记录
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_and_delete_invoice_requests(
    p_request_ids UUID[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id UUID;
    v_logistics_record_ids UUID[];
    v_all_logistics_ids UUID[] := '{}';
    v_deleted_count INTEGER := 0;
    v_partner_costs_count INTEGER := 0;
    v_logistics_records_count INTEGER := 0;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以作废开票申请单';
    END IF;
    
    -- 遍历每个申请单
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        -- 获取该申请单关联的所有运单ID
        SELECT array_agg(DISTINCT logistics_record_id)
        INTO v_logistics_record_ids
        FROM public.invoice_request_details
        WHERE invoice_request_id = v_request_id;
        
        -- 收集所有运单ID
        IF v_logistics_record_ids IS NOT NULL THEN
            v_all_logistics_ids := v_all_logistics_ids || v_logistics_record_ids;
        END IF;
        
        -- 回滚 logistics_partner_costs 状态
        UPDATE public.logistics_partner_costs
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE invoice_request_id = v_request_id;
        
        v_partner_costs_count := v_partner_costs_count + (SELECT COUNT(*) FROM public.logistics_partner_costs WHERE invoice_request_id = v_request_id);
        
        -- 删除开票申请明细
        DELETE FROM public.invoice_request_details
        WHERE invoice_request_id = v_request_id;
        
        -- 删除开票申请记录
        DELETE FROM public.invoice_requests
        WHERE id = v_request_id;
        
        v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    -- 回滚所有相关运单的状态
    IF array_length(v_all_logistics_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE id = ANY(v_all_logistics_ids);
        
        GET DIAGNOSTICS v_logistics_records_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '开票申请单已删除，运单状态已回滚',
        'deleted_requests', v_deleted_count,
        'affected_partner_costs', v_partner_costs_count,
        'affected_logistics_records', v_logistics_records_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '删除开票申请单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.void_and_delete_invoice_requests IS '
作废并删除开票申请单（批量）
- 删除 invoice_requests 记录
- 删除 invoice_request_details 明细记录
- 回滚 logistics_partner_costs.invoice_status → Uninvoiced
- 回滚 logistics_records.invoice_status → Uninvoiced
';

-- ============================================================
-- 2. 付款申请 - 作废并删除记录
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_and_delete_payment_requests(
    p_request_ids TEXT[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id TEXT;
    v_request record;
    v_logistics_record_ids UUID[];
    v_all_logistics_ids UUID[] := '{}';
    v_deleted_count INTEGER := 0;
    v_skipped_paid_count INTEGER := 0;
    v_partner_costs_count INTEGER := 0;
    v_logistics_records_count INTEGER := 0;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以作废付款申请单';
    END IF;
    
    -- 遍历每个申请单
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        -- 获取申请单信息
        SELECT * INTO v_request
        FROM public.payment_requests
        WHERE request_id = v_request_id;
        
        IF NOT FOUND THEN
            CONTINUE;
        END IF;
        
        -- 检查状态，跳过已付款的
        IF v_request.status = 'Paid' THEN
            v_skipped_paid_count := v_skipped_paid_count + 1;
            CONTINUE;
        END IF;
        
        -- 获取关联的运单ID
        v_logistics_record_ids := v_request.logistics_record_ids;
        
        -- 收集所有运单ID
        IF v_logistics_record_ids IS NOT NULL THEN
            v_all_logistics_ids := v_all_logistics_ids || v_logistics_record_ids;
        END IF;
        
        -- 回滚 logistics_partner_costs 状态
        IF v_logistics_record_ids IS NOT NULL AND array_length(v_logistics_record_ids, 1) > 0 THEN
            UPDATE public.logistics_partner_costs
            SET 
                payment_status = 'Unpaid',
                payment_request_id = NULL,
                payment_applied_at = NULL
            WHERE logistics_record_id = ANY(v_logistics_record_ids);
            
            v_partner_costs_count := v_partner_costs_count + (
                SELECT COUNT(*) 
                FROM public.logistics_partner_costs 
                WHERE logistics_record_id = ANY(v_logistics_record_ids)
            );
        END IF;
        
        -- 删除付款申请明细（如果有）
        DELETE FROM public.payment_items
        WHERE payment_request_id IN (
            SELECT id FROM public.payment_requests WHERE request_id = v_request_id
        );
        
        -- 删除付款申请记录
        DELETE FROM public.payment_requests
        WHERE request_id = v_request_id;
        
        v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    -- 回滚所有相关运单的付款状态
    IF array_length(v_all_logistics_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            payment_status = 'Unpaid',
            payment_request_id = NULL,
            payment_applied_at = NULL
        WHERE id = ANY(v_all_logistics_ids);
        
        GET DIAGNOSTICS v_logistics_records_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '付款申请单已删除，运单状态已回滚',
        'deleted_requests', v_deleted_count,
        'skipped_paid', v_skipped_paid_count,
        'affected_partner_costs', v_partner_costs_count,
        'affected_logistics_records', v_logistics_records_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '删除付款申请单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.void_and_delete_payment_requests IS '
作废并删除付款申请单（批量）
- 删除 payment_requests 记录
- 删除 payment_items 明细记录
- 回滚 logistics_partner_costs.payment_status → Unpaid
- 回滚 logistics_records.payment_status → Unpaid
- 跳过已付款的申请单
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 作废并删除函数已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增函数：';
    RAISE NOTICE '1. void_and_delete_invoice_requests';
    RAISE NOTICE '   - 删除开票申请记录';
    RAISE NOTICE '   - 回滚运单和合作方状态';
    RAISE NOTICE '';
    RAISE NOTICE '2. void_and_delete_payment_requests';
    RAISE NOTICE '   - 删除付款申请记录';
    RAISE NOTICE '   - 回滚运单和合作方状态';
    RAISE NOTICE '   - 跳过已付款的申请单';
    RAISE NOTICE '';
    RAISE NOTICE '功能对比：';
    RAISE NOTICE '- void_invoice_request: 作废申请单（保留记录）';
    RAISE NOTICE '- void_and_delete_invoice_requests: 作废并删除申请单';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

