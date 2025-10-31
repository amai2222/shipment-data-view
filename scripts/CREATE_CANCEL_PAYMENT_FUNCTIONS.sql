-- 创建取消付款函数（支持新的Approved状态）

BEGIN;

-- ============================================================================
-- 单个取消付款函数
-- ============================================================================

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

-- ============================================================================
-- 批量取消付款函数
-- ============================================================================

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

COMMIT;

SELECT '取消付款函数已创建' as message;

