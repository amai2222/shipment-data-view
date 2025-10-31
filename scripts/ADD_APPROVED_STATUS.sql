-- 新增Approved状态到付款流程
-- 修复审核和付款逻辑

BEGIN;

-- ============================================================================
-- 第1步：创建审核通过时更新运单状态的函数
-- ============================================================================

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
    'message', format('已审批通过，更新了%s条运单状态', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$$;

-- ============================================================================
-- 第2步：创建批量审核函数
-- ============================================================================

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
-- 第3步：创建付款函数（从Approved改为Paid）
-- ============================================================================

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
    'message', format('付款完成，更新了%s条运单状态', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$$;

-- ============================================================================
-- 第4步：创建批量付款函数
-- ============================================================================

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

COMMIT;

SELECT '付款流程函数已创建，现在支持Approved状态' as message;

