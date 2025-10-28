-- ============================================================
-- 修复 void_invoice_request 函数
-- ============================================================
-- 问题：函数尝试更新 logistics_records.invoice_status，但此字段已被删除
-- 原因：20250923000006 迁移将状态管理转移到 logistics_partner_costs 表
-- 解决：移除更新 logistics_records 的代码，只保留 logistics_partner_costs 的更新
-- ============================================================

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
    v_partner_costs_count integer;
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
    
    -- 作废申请单
    UPDATE public.invoice_requests
    SET 
        is_voided = true,
        voided_at = NOW(),
        voided_by = auth.uid(),
        void_reason = p_void_reason,
        status = 'Voided'
    WHERE id = p_request_id;
    
    -- ✅ 回滚 logistics_partner_costs 状态（这是唯一需要回滚的地方）
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_partner_costs_count = ROW_COUNT;
    
    -- ❌ 移除：不再更新 logistics_records 表的 invoice_status
    -- 原因：该字段已被删除，状态管理已转移到 logistics_partner_costs 表
    
    -- 删除开票申请明细
    DELETE FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'message', '开票申请单已作废，合作方成本状态已回滚',
        'affected_details', v_affected_count,
        'affected_partner_costs', v_partner_costs_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '作废开票申请单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.void_invoice_request IS '
作废开票申请单并回滚相关状态

回滚内容：
1. invoice_requests.status → Voided
2. logistics_partner_costs.invoice_status → Uninvoiced
3. logistics_partner_costs.invoice_request_id → NULL
4. logistics_partner_costs.invoice_applied_at → NULL
5. 删除 invoice_request_details 明细记录

说明：
- logistics_records 表不再有 invoice_status 字段
- 开票状态管理已转移到 logistics_partner_costs 表级别
- 每个运单的开票状态通过其关联的合作方成本记录反映
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ void_invoice_request 函数已更新';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '- 移除了对 logistics_records.invoice_status 的更新';
    RAISE NOTICE '- 保留了对 logistics_partner_costs 状态的回滚';
    RAISE NOTICE '';
    RAISE NOTICE '说明：';
    RAISE NOTICE '- logistics_records 表不再管理开票状态';
    RAISE NOTICE '- 开票状态已转移到 logistics_partner_costs 表管理';
    RAISE NOTICE '- 这是正确的设计，因为每个运单可能有多个合作方，';
    RAISE NOTICE '  每个合作方的开票状态可能不同';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

