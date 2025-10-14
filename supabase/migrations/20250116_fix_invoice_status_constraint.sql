-- 修复开票申请单status字段约束，允许Voided状态
-- 文件: supabase/migrations/20250116_fix_invoice_status_constraint.sql

-- 1. 删除旧的CHECK约束（如果存在）
ALTER TABLE public.invoice_requests 
DROP CONSTRAINT IF EXISTS invoice_requests_status_check;

-- 2. 添加新的CHECK约束，包含Voided状态
ALTER TABLE public.invoice_requests 
ADD CONSTRAINT invoice_requests_status_check 
CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Processing', 'Completed', 'Voided', 'Cancelled'));

-- 3. 更新void_invoice_request函数，使用Cancelled状态而不是Voided
-- 这样可以避免与is_voided字段冲突
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
    
    -- 作废申请单（使用Cancelled状态）
    UPDATE public.invoice_requests
    SET 
        is_voided = true,
        voided_at = NOW(),
        voided_by = auth.uid(),
        void_reason = p_void_reason,
        status = 'Cancelled'
    WHERE id = p_request_id;
    
    -- 更新相关的logistics_partner_costs状态（回滚运单状态）
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;
    
    -- 删除开票申请明细
    DELETE FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'message', '开票申请单已作废',
        'affected_records', v_affected_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '作废开票申请单失败: ' || SQLERRM
    );
END;
$$;

-- 4. 添加注释
COMMENT ON CONSTRAINT invoice_requests_status_check ON public.invoice_requests IS 
'开票申请单状态约束：Pending-待审核, Approved-已批准, Rejected-已拒绝, Processing-处理中, Completed-已完成, Voided-已作废, Cancelled-已取消';

