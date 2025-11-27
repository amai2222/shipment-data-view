-- ============================================================================
-- 将6个函数的权限检查统一为_1126版本（包含对账函数和单个付款函数）
-- ============================================================================
-- 问题：数据库函数中缺少权限检查或使用硬编码的角色检查
-- 解决：添加统一权限系统检查 has_function_permission()
-- ============================================================================
-- 创建时间: 2025-11-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. cancel_payment_request_1126 - 取消付款申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_payment_request_1126(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record_ids UUID[];
  v_updated_count INTEGER;
  v_current_status TEXT;
BEGIN
  -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
  -- 检查功能权限：finance.cancel_payment
  IF NOT public.has_function_permission('finance.cancel_payment') THEN
    RAISE EXCEPTION '权限不足：您没有取消付款申请的权限。请联系管理员在权限管理中分配 "finance.cancel_payment" 权限。';
  END IF;

  -- 获取申请单当前状态和运单ID列表
  SELECT status, logistics_record_ids 
  INTO v_current_status, v_record_ids
  FROM payment_requests
  WHERE request_id = p_request_id;

  -- 只有已支付状态才能取消付款
  IF v_current_status != 'Paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '只有已支付状态的申请单才能取消付款'
    );
  END IF;

  IF v_record_ids IS NULL OR array_length(v_record_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '未找到关联的运单'
    );
  END IF;

  -- 更新申请单状态回到已审批
  UPDATE payment_requests
  SET status = 'Approved'
  WHERE request_id = p_request_id;

  -- 更新运单状态回到审核通过
  UPDATE logistics_records
  SET 
    payment_status = 'Approved',
    payment_completed_at = NULL
  WHERE id = ANY(v_record_ids)
    AND payment_status = 'Paid';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- 更新合作方成本状态
  UPDATE logistics_partner_costs
  SET 
    payment_status = 'Processing',
    payment_completed_at = NULL
  WHERE logistics_record_id = ANY(v_record_ids)
    AND payment_status = 'Paid';

  RETURN jsonb_build_object(
    'success', true,
    'message', format('取消付款成功，%s条运单状态已回退到"支付审核通过"', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$function$;

COMMENT ON FUNCTION public.cancel_payment_request_1126 IS '取消付款申请（使用统一权限系统：finance.cancel_payment）';

-- ============================================================================
-- 2. rollback_payment_request_approval_1126 - 回滚付款审批
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rollback_payment_request_approval_1126(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record_ids UUID[];
  v_current_status TEXT;
  v_updated_count INTEGER;
BEGIN
  -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
  -- 检查功能权限：finance.rollback_payment_approval
  IF NOT public.has_function_permission('finance.rollback_payment_approval') THEN
    RAISE EXCEPTION '权限不足：您没有回滚付款审批的权限。请联系管理员在权限管理中分配 "finance.rollback_payment_approval" 权限。';
  END IF;

  -- 获取申请单状态和运单ID列表
  SELECT status, logistics_record_ids 
  INTO v_current_status, v_record_ids
  FROM payment_requests
  WHERE request_id = p_request_id;

  -- 只有Approved状态才能取消审批
  IF v_current_status != 'Approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '只有"已审批待支付"状态的申请单才能取消审批'
    );
  END IF;

  -- 更新申请单状态回到待审核
  UPDATE payment_requests
  SET status = 'Pending'
  WHERE request_id = p_request_id;

  -- 更新运单状态回到已申请支付
  UPDATE logistics_records
  SET payment_status = 'Processing'
  WHERE id = ANY(v_record_ids)
    AND payment_status = 'Approved';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('取消审批成功，%s条运单状态已回退到"已申请支付"', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$function$;

COMMENT ON FUNCTION public.rollback_payment_request_approval_1126 IS '回滚付款审批（使用统一权限系统：finance.rollback_payment_approval）';

-- ============================================================================
-- 3. batch_rollback_payment_approval_1126 - 批量回滚付款审批
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_rollback_payment_approval_1126(p_request_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_updated INTEGER := 0;
  v_total_skipped INTEGER := 0;
  v_request_id TEXT;
  v_result JSONB;
BEGIN
  -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
  -- 检查功能权限：finance.rollback_payment_approval
  IF NOT public.has_function_permission('finance.rollback_payment_approval') THEN
    RAISE EXCEPTION '权限不足：您没有批量回滚付款审批的权限。请联系管理员在权限管理中分配 "finance.rollback_payment_approval" 权限。';
  END IF;

  FOREACH v_request_id IN ARRAY p_request_ids
  LOOP
    v_result := rollback_payment_request_approval_1126(v_request_id);
    IF (v_result->>'success')::BOOLEAN THEN
      v_total_updated := v_total_updated + 1;
    ELSE
      v_total_skipped := v_total_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('已取消%s个审批，跳过%s个', v_total_updated, v_total_skipped),
    'rollback_count', v_total_updated,
    'skipped_count', v_total_skipped
  );
END;
$function$;

COMMENT ON FUNCTION public.batch_rollback_payment_approval_1126 IS '批量回滚付款审批（使用统一权限系统：finance.rollback_payment_approval）';

-- ============================================================================
-- 4. pay_payment_request_1126 - 完成单个付款申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pay_payment_request_1126(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record_ids UUID[];
  v_updated_count INTEGER;
BEGIN
  -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
  -- 检查功能权限：finance.pay_payment
  IF NOT public.has_function_permission('finance.pay_payment') THEN
    RAISE EXCEPTION '权限不足：您没有完成付款的权限。请联系管理员在权限管理中分配 "finance.pay_payment" 权限。';
  END IF;

  -- 获取申请单的运单ID列表
  SELECT logistics_record_ids INTO v_record_ids
  FROM payment_requests
  WHERE request_id = p_request_id
    AND status = 'Approved';
  
  IF v_record_ids IS NULL OR array_length(v_record_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '申请单未审批或未找到关联运单'
    );
  END IF;
  
  -- 更新申请单状态为已支付
  UPDATE payment_requests
  SET status = 'Paid'
  WHERE request_id = p_request_id;
  
  -- 更新运单状态为已支付
  UPDATE logistics_records
  SET 
    payment_status = 'Paid',
    payment_completed_at = NOW()
  WHERE id = ANY(v_record_ids)
    AND payment_status = 'Approved';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- 更新合作方成本状态为已支付
  UPDATE logistics_partner_costs
  SET 
    payment_status = 'Paid',
    payment_completed_at = NOW()
  WHERE logistics_record_id = ANY(v_record_ids)
    AND payment_status = 'Processing';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('付款完成，%s条运单状态已更新为"已支付"', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$function$;

COMMENT ON FUNCTION public.pay_payment_request_1126 IS '完成单个付款申请（使用统一权限系统：finance.pay_payment）';

-- ============================================================================
-- 5. batch_pay_payment_requests_1126 - 批量完成付款
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_pay_payment_requests_1126(p_request_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_updated INTEGER := 0;
  v_request_id TEXT;
  v_result JSONB;
BEGIN
  -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
  -- 检查功能权限：finance.pay_payment
  IF NOT public.has_function_permission('finance.pay_payment') THEN
    RAISE EXCEPTION '权限不足：您没有完成付款的权限。请联系管理员在权限管理中分配 "finance.pay_payment" 权限。';
  END IF;

  FOREACH v_request_id IN ARRAY p_request_ids
  LOOP
    -- ✅ 调用 pay_payment_request_1126（已集成统一权限系统）
    v_result := pay_payment_request_1126(v_request_id);
    IF (v_result->>'success')::BOOLEAN THEN
      v_total_updated := v_total_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('已完成%s个付款申请的付款', v_total_updated),
    'paid_count', v_total_updated
  );
END;
$function$;

COMMENT ON FUNCTION public.batch_pay_payment_requests_1126 IS '批量完成付款（使用统一权限系统：finance.pay_payment）';

-- ============================================================================
-- 6. reconcile_partner_costs_batch_1126 - 批量对账合作方成本
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_partner_costs_batch_1126(
    p_cost_ids UUID[],
    p_reconciliation_status TEXT DEFAULT 'Reconciled',
    p_reconciliation_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
    v_status TEXT;
BEGIN
    -- ✅ 使用统一权限系统检查（保持一致性，创建_1126版本）
    -- 检查功能权限：finance.reconcile
    IF NOT public.has_function_permission('finance.reconcile') THEN
        RAISE EXCEPTION '权限不足：您没有运费对账权限。请联系管理员在权限管理中分配 "finance.reconcile" 权限。';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 校验对账状态
    IF p_reconciliation_status NOT IN ('Reconciled', 'Unreconciled', 'Exception') THEN
        RAISE EXCEPTION '对账状态无效: %。有效值：Reconciled, Unreconciled, Exception', p_reconciliation_status;
    END IF;

    -- 更新对账信息
    UPDATE public.logistics_partner_costs
    SET 
        reconciliation_status = p_reconciliation_status,
        reconciliation_date = CASE 
            WHEN p_reconciliation_status = 'Reconciled' THEN NOW()
            ELSE reconciliation_date
        END,
        reconciliation_by = CASE 
            WHEN p_reconciliation_status = 'Reconciled' THEN v_user_id
            ELSE reconciliation_by
        END,
        reconciliation_notes = p_reconciliation_notes,
        updated_at = NOW()
    WHERE id = ANY(p_cost_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 返回结果
    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功对账 %s 条记录，状态：%s', v_count, 
            CASE p_reconciliation_status 
                WHEN 'Reconciled' THEN '已对账'
                WHEN 'Unreconciled' THEN '未对账'
                WHEN 'Exception' THEN '异常'
            END),
        'count', v_count
    );
END;
$function$;

COMMENT ON FUNCTION public.reconcile_partner_costs_batch_1126 IS '批量对账合作方成本记录（使用统一权限系统：finance.reconcile）';

COMMIT;

-- ============================================================================
-- 完成说明
-- ============================================================================
-- 已创建6个函数的_1126版本，所有权限检查已统一为统一权限系统：
-- 1. cancel_payment_request_1126 - 使用 finance.cancel_payment
-- 2. rollback_payment_request_approval_1126 - 使用 finance.rollback_payment_approval
-- 3. batch_rollback_payment_approval_1126 - 使用 finance.rollback_payment_approval
--    （内部调用 rollback_payment_request_approval_1126）
-- 4. pay_payment_request_1126 - 使用 finance.pay_payment
-- 5. batch_pay_payment_requests_1126 - 使用 finance.pay_payment
--    （内部调用 pay_payment_request_1126）
-- 6. reconcile_partner_costs_batch_1126 - 使用 finance.reconcile
-- ============================================================================

