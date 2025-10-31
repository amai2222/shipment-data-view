-- 修复取消审批函数，确保运单状态也更新为Approved而不是Processing

BEGIN;

-- ============================================================================
-- 修复单个取消审批函数
-- ============================================================================

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

-- ============================================================================
-- 修复批量取消审批函数
-- ============================================================================

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

SELECT '取消审批函数已修复' as message;

