-- ============================================================================
-- 完整的付款流程修复SQL（一次性执行）
-- 包含：约束修复 + 审批函数 + 付款函数 + 取消付款函数
-- ============================================================================

BEGIN;

-- ============================================================================
-- 第1部分：修复payment_status约束，添加Approved状态
-- ============================================================================

-- logistics_records表
ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS logistics_records_payment_status_check;

ALTER TABLE logistics_records
ADD CONSTRAINT logistics_records_payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

-- logistics_partner_costs表
ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS logistics_partner_costs_payment_status_check;

ALTER TABLE logistics_partner_costs
ADD CONSTRAINT logistics_partner_costs_payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

-- ============================================================================
-- 第2部分：创建审批函数
-- ============================================================================

-- 单个审批函数
CREATE OR REPLACE FUNCTION public.approve_payment_request(
  p_request_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_ids UUID[];
  v_updated_count INTEGER;
BEGIN
  -- 获取申请单的运单ID列表
  SELECT logistics_record_ids INTO v_record_ids
  FROM payment_requests
  WHERE request_id = p_request_id;
  
  IF v_record_ids IS NULL OR array_length(v_record_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '未找到关联的运单'
    );
  END IF;
  
  -- 更新申请单状态为已审批
  UPDATE payment_requests
  SET status = 'Approved'
  WHERE request_id = p_request_id;
  
  -- 更新运单状态为支付审核通过
  UPDATE logistics_records
  SET payment_status = 'Approved'
  WHERE id = ANY(v_record_ids)
    AND payment_status = 'Processing';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('已审批通过，%s条运单状态已更新为"支付审核通过"', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$$;

-- 批量审批函数
CREATE OR REPLACE FUNCTION public.batch_approve_payment_requests(
  p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_updated INTEGER := 0;
  v_request_id TEXT;
  v_result JSONB;
BEGIN
  FOREACH v_request_id IN ARRAY p_request_ids
  LOOP
    v_result := approve_payment_request(v_request_id);
    IF (v_result->>'success')::BOOLEAN THEN
      v_total_updated := v_total_updated + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('已审批%s个付款申请', v_total_updated),
    'approved_count', v_total_updated
  );
END;
$$;

-- ============================================================================
-- 第3部分：创建付款函数
-- ============================================================================

-- 单个付款函数
CREATE OR REPLACE FUNCTION public.pay_payment_request(
  p_request_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_ids UUID[];
  v_updated_count INTEGER;
BEGIN
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
$$;

-- 批量付款函数
CREATE OR REPLACE FUNCTION public.batch_pay_payment_requests(
  p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_updated INTEGER := 0;
  v_request_id TEXT;
  v_result JSONB;
BEGIN
  FOREACH v_request_id IN ARRAY p_request_ids
  LOOP
    v_result := pay_payment_request(v_request_id);
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
$$;

-- ============================================================================
-- 第4部分：创建取消付款函数
-- ============================================================================

-- 单个取消付款函数
CREATE OR REPLACE FUNCTION public.cancel_payment_request(
  p_request_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_ids UUID[];
  v_updated_count INTEGER;
  v_current_status TEXT;
BEGIN
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
$$;

-- 批量取消付款函数
CREATE OR REPLACE FUNCTION public.batch_cancel_payment_requests(
  p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_updated INTEGER := 0;
  v_total_skipped INTEGER := 0;
  v_request_id TEXT;
  v_result JSONB;
BEGIN
  FOREACH v_request_id IN ARRAY p_request_ids
  LOOP
    v_result := cancel_payment_request(v_request_id);
    IF (v_result->>'success')::BOOLEAN THEN
      v_total_updated := v_total_updated + 1;
    ELSE
      v_total_skipped := v_total_skipped + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('已取消%s个付款申请的付款，跳过%s个', v_total_updated, v_total_skipped),
    'cancelled_count', v_total_updated,
    'skipped_count', v_total_skipped
  );
END;
$$;

-- ============================================================================
-- 第5部分：创建取消审批函数
-- ============================================================================

-- 单个取消审批函数
CREATE OR REPLACE FUNCTION public.rollback_payment_request_approval(
  p_request_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_ids UUID[];
  v_current_status TEXT;
  v_updated_count INTEGER;
BEGIN
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
$$;

-- 批量取消审批函数
CREATE OR REPLACE FUNCTION public.batch_rollback_payment_approval(
  p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_updated INTEGER := 0;
  v_total_skipped INTEGER := 0;
  v_request_id TEXT;
  v_result JSONB;
BEGIN
  FOREACH v_request_id IN ARRAY p_request_ids
  LOOP
    v_result := rollback_payment_request_approval(v_request_id);
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
$$;

COMMIT;

-- ============================================================================
-- 验证
-- ============================================================================

SELECT '✅ 付款流程修复完成' as message;

SELECT 
  proname as function_name,
  '已创建' as status
FROM pg_proc
WHERE proname IN (
  'approve_payment_request',
  'batch_approve_payment_requests',
  'pay_payment_request',
  'batch_pay_payment_requests',
  'cancel_payment_request',
  'batch_cancel_payment_requests'
)
ORDER BY proname;

