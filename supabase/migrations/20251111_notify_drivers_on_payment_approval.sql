-- ============================================================
-- 审批通过时通知相关司机
-- 创建时间: 2025-11-11
-- 功能: 当付款申请审批通过时，自动通知相关运单的司机
-- ============================================================

BEGIN;

-- ============================================================
-- 第一步：创建通知司机的辅助函数
-- ============================================================

CREATE OR REPLACE FUNCTION notify_drivers_on_payment_approval(
    p_request_id TEXT,
    p_record_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_record RECORD;
    v_user_id UUID;
    v_notified_count INTEGER := 0;
    v_project_name TEXT;
    v_total_amount NUMERIC;
    v_driver_name TEXT;
BEGIN
    -- 获取项目名称和总金额（用于通知内容）
    SELECT 
        DISTINCT lr.project_name,
        COALESCE(SUM(lpc.payable_amount) OVER (), 0) as total_amount
    INTO v_project_name, v_total_amount
    FROM logistics_records lr
    LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
    WHERE lr.id = ANY(p_record_ids)
    LIMIT 1;
    
    v_project_name := COALESCE(v_project_name, '未知项目');
    
    -- 遍历所有相关的运单记录，找到对应的司机并通知
    FOR v_driver_record IN
        SELECT DISTINCT
            lr.driver_id,
            lr.driver_name,
            lr.user_id,
            id.user_id as internal_driver_user_id,
            id.linked_user_id as internal_driver_linked_user_id
        FROM logistics_records lr
        LEFT JOIN internal_drivers id ON lr.driver_id = id.id
        WHERE lr.id = ANY(p_record_ids)
          AND (lr.user_id IS NOT NULL 
               OR id.user_id IS NOT NULL 
               OR id.linked_user_id IS NOT NULL)
    LOOP
        -- 确定要通知的用户ID（优先级：user_id > internal_driver_user_id > linked_user_id）
        v_user_id := COALESCE(
            v_driver_record.user_id,
            v_driver_record.internal_driver_user_id,
            v_driver_record.internal_driver_linked_user_id
        );
        
        v_driver_name := COALESCE(v_driver_record.driver_name, '司机');
        
        -- 如果找到了用户ID，创建通知
        IF v_user_id IS NOT NULL THEN
            INSERT INTO notifications (
                user_id,
                type,
                category,
                title,
                message,
                link
            ) VALUES (
                v_user_id,
                'success',
                'finance',
                '付款审批通过',
                format('您的运单付款申请已审批通过。项目：%s，涉及运单已更新为"支付审核通过"状态。', v_project_name),
                '/m/payment-requests'
            );
            
            v_notified_count := v_notified_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_notified_count;
END;
$$;

COMMENT ON FUNCTION notify_drivers_on_payment_approval IS '审批通过时通知相关司机（通过运单记录找到司机并发送通知）';

-- ============================================================
-- 第二步：修改审批函数，添加通知逻辑
-- ============================================================

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
  v_notified_count INTEGER := 0;
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
  
  -- ✅ 通知相关司机
  v_notified_count := notify_drivers_on_payment_approval(p_request_id, v_record_ids);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('已审批通过，更新了%s条运单状态，已通知%s位司机', v_updated_count, v_notified_count),
    'updated_count', v_updated_count,
    'notified_count', v_notified_count
  );
END;
$$;

COMMENT ON FUNCTION public.approve_payment_request IS '审批付款申请并通知相关司机（已更新：添加司机通知功能）';

-- ============================================================
-- 第三步：修改批量审批函数，添加通知逻辑
-- ============================================================

CREATE OR REPLACE FUNCTION public.batch_approve_payment_requests(
    p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id TEXT;
    v_approved_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
    v_result JSONB;
    v_record_ids UUID[];
    v_notified_count INTEGER := 0;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以批量审批';
    END IF;

    -- 遍历每个申请单ID
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        BEGIN
            -- 检查申请单状态
            IF EXISTS (
                SELECT 1 FROM public.payment_requests 
                WHERE request_id = v_request_id AND status = 'Pending'
            ) THEN
                -- 获取运单ID列表
                SELECT logistics_record_ids INTO v_record_ids
                FROM payment_requests
                WHERE request_id = v_request_id;
                
                -- 更新状态为已审批
                UPDATE public.payment_requests
                SET 
                    status = 'Approved',
                    updated_at = NOW(),
                    notes = COALESCE(notes, '') || ' [批量审批]'
                WHERE request_id = v_request_id;
                
                -- 更新运单状态
                UPDATE logistics_records
                SET payment_status = 'Approved'
                WHERE id = ANY(v_record_ids)
                  AND payment_status = 'Processing';
                
                -- ✅ 通知相关司机
                IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
                    v_notified_count := v_notified_count + notify_drivers_on_payment_approval(
                        v_request_id, 
                        v_record_ids
                    );
                END IF;
                
                v_approved_count := v_approved_count + 1;
            ELSE
                v_failed_count := v_failed_count + 1;
                v_failed_requests := array_append(v_failed_requests, v_request_id);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_requests := array_append(v_failed_requests, v_request_id);
        END;
    END LOOP;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'approved_count', v_approved_count,
        'failed_count', v_failed_count,
        'notified_count', v_notified_count,
        'message', format('已审批%s个申请单，已通知%s位司机', v_approved_count, v_notified_count)
    );
    
    IF array_length(v_failed_requests, 1) > 0 THEN
        v_result := v_result || jsonb_build_object('failed_requests', v_failed_requests);
    END IF;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.batch_approve_payment_requests IS '批量审批付款申请并通知相关司机（已更新：添加司机通知功能）';

COMMIT;

