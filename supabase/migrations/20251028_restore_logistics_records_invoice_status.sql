-- ============================================================
-- 恢复 logistics_records 表的 invoice_status 字段
-- ============================================================
-- 问题：20250923000006 迁移错误地删除了 logistics_records.invoice_status 字段
-- 但实际上：
-- 1. 申请开票时会更新 logistics_records.invoice_status = 'Processing'
-- 2. 作废开票时应该回滚 logistics_records.invoice_status = 'Uninvoiced'
-- 解决：恢复该字段，并修复 void_invoice_request 函数
-- ============================================================

BEGIN;

-- 1. 恢复 logistics_records 表的 invoice_status 相关字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'Uninvoiced' 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));

ALTER TABLE public.logistics_records
ADD COLUMN IF NOT EXISTS invoice_applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invoice_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invoice_request_id UUID,
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 2. 为现有记录设置默认状态
UPDATE public.logistics_records 
SET invoice_status = 'Uninvoiced'
WHERE invoice_status IS NULL;

-- 3. 添加索引
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status 
ON public.logistics_records(invoice_status);

-- 4. 添加字段注释
COMMENT ON COLUMN public.logistics_records.invoice_status IS '开票状态: Uninvoiced-未开票, Processing-已申请开票, Invoiced-已完成开票';
COMMENT ON COLUMN public.logistics_records.invoice_applied_at IS '开票申请时间';
COMMENT ON COLUMN public.logistics_records.invoice_completed_at IS '开票完成时间';
COMMENT ON COLUMN public.logistics_records.invoice_request_id IS '关联的开票申请ID';
COMMENT ON COLUMN public.logistics_records.invoice_number IS '发票号码';

-- 5. 修复 void_invoice_request 函数，确保回滚 logistics_records 状态
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
    v_partner_costs_count integer;
    v_logistics_records_count integer;
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
    
    -- ✅ 回滚 logistics_partner_costs 状态
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_partner_costs_count = ROW_COUNT;
    
    -- ✅ 回滚 logistics_records 状态（这是主要的状态字段）
    IF v_logistics_record_ids IS NOT NULL AND array_length(v_logistics_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE id = ANY(v_logistics_record_ids);
        
        GET DIAGNOSTICS v_logistics_records_count = ROW_COUNT;
    END IF;
    
    -- 删除开票申请明细
    DELETE FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'message', '开票申请单已作废，运单状态已回滚',
        'affected_details', v_affected_count,
        'affected_partner_costs', v_partner_costs_count,
        'affected_logistics_records', v_logistics_records_count
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
2. ✅ logistics_partner_costs.invoice_status → Uninvoiced
3. ✅ logistics_partner_costs.invoice_request_id → NULL
4. ✅ logistics_partner_costs.invoice_applied_at → NULL
5. ✅ logistics_records.invoice_status → Uninvoiced
6. ✅ logistics_records.invoice_request_id → NULL
7. ✅ logistics_records.invoice_applied_at → NULL
8. 删除 invoice_request_details 明细记录

说明：
- 同时回滚 logistics_records 和 logistics_partner_costs 两个表
- logistics_records.invoice_status 用于运单级别的状态显示
- logistics_partner_costs.invoice_status 用于合作方级别的状态跟踪
- 两个表都需要正确回滚，确保数据一致性
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ logistics_records.invoice_status 字段已恢复';
    RAISE NOTICE '✅ void_invoice_request 函数已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '恢复的字段：';
    RAISE NOTICE '- invoice_status (开票状态)';
    RAISE NOTICE '- invoice_applied_at (开票申请时间)';
    RAISE NOTICE '- invoice_completed_at (开票完成时间)';
    RAISE NOTICE '- invoice_request_id (开票申请ID)';
    RAISE NOTICE '- invoice_number (发票号码)';
    RAISE NOTICE '';
    RAISE NOTICE '修复的函数：';
    RAISE NOTICE '- void_invoice_request 现在会同时回滚两个表：';
    RAISE NOTICE '  1. ✅ logistics_partner_costs.invoice_status → Uninvoiced';
    RAISE NOTICE '  2. ✅ logistics_records.invoice_status → Uninvoiced';
    RAISE NOTICE '';
    RAISE NOTICE '重要说明：';
    RAISE NOTICE '- 两个表都有 invoice_status 字段';
    RAISE NOTICE '- logistics_partner_costs: 合作方级别的状态';
    RAISE NOTICE '- logistics_records: 运单级别的状态';
    RAISE NOTICE '- 现在作废开票申请后，运单状态会正确显示为"未开票"！';
    RAISE NOTICE '========================================';
END $$;

