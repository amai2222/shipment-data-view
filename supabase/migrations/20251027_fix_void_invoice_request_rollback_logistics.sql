-- 修复作废开票申请单时需要同时回滚logistics_records表的开票状态
-- 问题：void_invoice_request函数只回滚了logistics_partner_costs，没有回滚logistics_records
-- 解决：添加回滚logistics_records的逻辑

BEGIN;

CREATE OR REPLACE FUNCTION public.void_invoice_request(
    p_request_id uuid,
    p_void_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_affected_count integer;
    v_logistics_record_ids uuid[];
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以作废开票申请单';
    END IF;
    
    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请单不存在';
    END IF;
    
    -- 检查是否已经作废
    IF v_request.is_voided THEN
        RAISE EXCEPTION '该申请单已经作废';
    END IF;
    
    -- 获取该申请单关联的所有运单ID
    SELECT array_agg(DISTINCT logistics_record_id)
    INTO v_logistics_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;
    
    -- 作废申请单
    UPDATE public.invoice_requests
    SET 
        is_voided = true,
        voided_at = NOW(),
        voided_by = auth.uid(),
        void_reason = p_void_reason,
        status = 'Voided'
    WHERE id = p_request_id;
    
    -- ✅ 回滚logistics_partner_costs状态
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;
    
    -- ✅ 关键修复：回滚logistics_records的开票状态
    IF v_logistics_record_ids IS NOT NULL AND array_length(v_logistics_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE id = ANY(v_logistics_record_ids);
    END IF;
    
    -- 删除开票申请明细
    DELETE FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'message', '开票申请单已作废，运单状态已回滚',
        'affected_records', v_affected_count,
        'logistics_records_count', COALESCE(array_length(v_logistics_record_ids, 1), 0)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '作废开票申请单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.void_invoice_request IS '
作废开票申请单并完整回滚所有相关状态
回滚内容：
1. invoice_requests.status → Voided
2. logistics_partner_costs.invoice_status → Uninvoiced
3. ✅ logistics_records.invoice_status → Uninvoiced (新增)
4. 清理invoice_request_details明细记录
';

COMMIT;

