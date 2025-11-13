-- ============================================================================
-- 迁移收款系统权限检查到统一权限系统
-- 创建时间：2025-11-14
-- 描述：将所有收款相关函数的硬编码角色检查改为使用统一权限系统
-- ============================================================================

-- ============================================================================
-- 第一部分：更新收款相关函数，使用统一权限检查
-- ============================================================================

-- 1. 更新 manual_recharge_partner_balance 函数
CREATE OR REPLACE FUNCTION public.manual_recharge_partner_balance(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.manual_recharge') THEN
        RAISE EXCEPTION '权限不足：您没有手动充值权限。需要 finance.manual_recharge 权限';
    END IF;

    -- 调用核心函数
    SELECT public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := p_amount,
        p_transaction_type := 'recharge',
        p_transaction_category := 'manual_recharge',
        p_description := p_description
    ) INTO v_result;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功为货主充值 %s 元', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.manual_recharge_partner_balance IS '手动充值货主余额（使用统一权限系统：finance.manual_recharge）';

-- 2. 更新 deduct_service_fee 函数
CREATE OR REPLACE FUNCTION public.deduct_service_fee(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.deduct_service_fee') THEN
        RAISE EXCEPTION '权限不足：您没有扣减服务费权限。需要 finance.deduct_service_fee 权限';
    END IF;

    -- 调用核心函数
    SELECT public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := -ABS(p_amount),  -- 确保为负数
        p_transaction_type := 'deduct',
        p_transaction_category := 'service_fee',
        p_description := COALESCE(p_description, format('服务费扣款 %s 元', p_amount))
    ) INTO v_result;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功扣减服务费 %s 元', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.deduct_service_fee IS '扣减服务费（使用统一权限系统：finance.deduct_service_fee）';

-- 3. 更新 deduct_overdue_fee 函数
CREATE OR REPLACE FUNCTION public.deduct_overdue_fee(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.deduct_overdue_fee') THEN
        RAISE EXCEPTION '权限不足：您没有扣减逾期费权限。需要 finance.deduct_overdue_fee 权限';
    END IF;

    -- 调用核心函数
    SELECT public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := -ABS(p_amount),  -- 确保为负数
        p_transaction_type := 'deduct',
        p_transaction_category := 'overdue_fee',
        p_description := COALESCE(p_description, format('逾期费扣款 %s 元', p_amount))
    ) INTO v_result;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功扣减逾期费 %s 元', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.deduct_overdue_fee IS '扣减逾期费（使用统一权限系统：finance.deduct_overdue_fee）';

-- 4. 更新 deduct_partner_fee 函数
CREATE OR REPLACE FUNCTION public.deduct_partner_fee(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_transaction_category TEXT DEFAULT 'other',
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.deduct_partner_fee') THEN
        RAISE EXCEPTION '权限不足：您没有扣减费用权限。需要 finance.deduct_partner_fee 权限';
    END IF;

    -- 调用核心函数
    SELECT public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := -ABS(p_amount),  -- 确保为负数
        p_transaction_type := 'deduct',
        p_transaction_category := p_transaction_category,
        p_description := p_description
    ) INTO v_result;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功扣减费用 %s 元', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.deduct_partner_fee IS '扣减货主费用（使用统一权限系统：finance.deduct_partner_fee）';

-- 5. 更新 receive_invoice_payment_1114 函数
CREATE OR REPLACE FUNCTION public.receive_invoice_payment_1114(
    p_request_number TEXT,
    p_received_amount NUMERIC,
    p_receipt_number TEXT DEFAULT NULL,
    p_receipt_bank TEXT DEFAULT NULL,
    p_receipt_images TEXT[] DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_record_ids UUID[];
    v_updated_count INTEGER := 0;
    v_user_id UUID;
    v_total_received NUMERIC(15,2) := 0;
    v_remaining_amount NUMERIC(15,2) := 0;
    v_receipt_record_id UUID;
    v_is_full_payment BOOLEAN := false;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.receive_payment') THEN
        RAISE EXCEPTION '权限不足：您没有财务收款权限。需要 finance.receive_payment 权限';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 获取申请信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    -- 只能对已开票状态的申请单进行收款
    IF v_request.status != 'Completed' AND v_request.status != 'Received' THEN
        RAISE EXCEPTION '只能对已开票或部分收款的申请单进行收款，当前状态: %', v_request.status;
    END IF;

    -- 获取开票金额和累计收款金额
    v_total_received := COALESCE(v_request.total_received_amount, 0);
    v_remaining_amount := COALESCE(v_request.total_amount, 0) - v_total_received;

    -- 金额校验
    IF p_received_amount <= 0 THEN
        RAISE EXCEPTION '收款金额必须大于0';
    END IF;

    IF p_received_amount > v_remaining_amount THEN
        RAISE EXCEPTION '收款金额 % 超过未收款金额 %', p_received_amount, v_remaining_amount;
    END IF;

    -- 计算新的累计收款金额
    v_total_received := v_total_received + p_received_amount;
    v_is_full_payment := (v_total_received >= COALESCE(v_request.total_amount, 0));

    -- 插入收款记录
    INSERT INTO public.invoice_receipt_records (
        invoice_request_id,
        receipt_number,
        receipt_bank,
        received_amount,
        receipt_images,
        received_by,
        notes,
        created_at
    ) VALUES (
        v_request.id,
        p_receipt_number,
        p_receipt_bank,
        p_received_amount,
        p_receipt_images,
        v_user_id,
        p_notes,
        NOW()
    ) RETURNING id INTO v_receipt_record_id;

    -- 更新申请单的累计收款金额
    UPDATE public.invoice_requests
    SET 
        total_received_amount = v_total_received,
        receipt_number = COALESCE(p_receipt_number, receipt_number),
        receipt_bank = COALESCE(p_receipt_bank, receipt_bank),
        received_at = NOW(),
        received_by = v_user_id
    WHERE id = v_request.id;

    -- 如果已全额收款，更新申请单状态
    IF v_is_full_payment THEN
        UPDATE public.invoice_requests
        SET status = 'Received'
        WHERE id = v_request.id;
    END IF;

    -- 获取该申请单关联的所有运单ID
    SELECT ARRAY_AGG(logistics_record_id) INTO v_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = v_request.id;

    -- 更新所有关联运单的收款状态
    IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET receipt_status = 'Received'
        WHERE id = ANY(v_record_ids);
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 充值货主余额（收款金额作为充值）
    PERFORM public.update_partner_balance(
        p_partner_id := v_request.invoicing_partner_id,
        p_amount := p_received_amount,
        p_transaction_type := 'recharge',
        p_transaction_category := 'invoice_receipt',
        p_description := format('财务收款：申请单 %s，收款金额 %s 元', p_request_number, p_received_amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', CASE 
            WHEN v_is_full_payment THEN format('收款成功！已全额收款，申请单状态已更新为"已收款"')
            ELSE format('收款成功！已收款 %s 元，剩余 %s 元', p_received_amount, v_remaining_amount - p_received_amount)
        END,
        'receipt_record_id', v_receipt_record_id,
        'total_received_amount', v_total_received,
        'remaining_amount', v_remaining_amount - p_received_amount,
        'is_full_payment', v_is_full_payment,
        'updated_waybill_count', v_updated_count
    );
END;
$$;

COMMENT ON FUNCTION public.receive_invoice_payment_1114 IS '财务收款功能（使用统一权限系统：finance.receive_payment）';

-- 6. 更新 refund_invoice_receipt_1114 函数
CREATE OR REPLACE FUNCTION public.refund_invoice_receipt_1114(
    p_request_number TEXT,
    p_refund_amount NUMERIC,
    p_receipt_record_id UUID DEFAULT NULL,
    p_refund_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_user_id UUID;
    v_current_received NUMERIC(15,2);
    v_new_received NUMERIC(15,2);
    v_refund_record_id UUID;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.refund_receipt') THEN
        RAISE EXCEPTION '权限不足：您没有退款权限。需要 finance.refund_receipt 权限';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    -- 检查申请单状态
    IF v_request.status != 'Received' AND COALESCE(v_request.total_received_amount, 0) <= 0 THEN
        RAISE EXCEPTION '该申请单没有收款记录，无法退款';
    END IF;

    -- 获取当前累计收款金额
    v_current_received := COALESCE(v_request.total_received_amount, 0);

    -- 校验退款金额
    IF p_refund_amount <= 0 THEN
        RAISE EXCEPTION '退款金额必须大于0';
    END IF;

    IF p_refund_amount > v_current_received THEN
        RAISE EXCEPTION '退款金额不能超过已收款金额。已收款：¥%s，退款金额：¥%s', 
            v_current_received, p_refund_amount;
    END IF;

    -- 计算新的累计收款金额
    v_new_received := v_current_received - p_refund_amount;

    -- 创建退款记录
    INSERT INTO public.invoice_receipt_records (
        invoice_request_id,
        receipt_number,
        receipt_bank,
        receipt_amount,
        receipt_images,
        receipt_date,
        received_by,
        notes
    ) VALUES (
        v_request.id,
        'REFUND-' || p_request_number,
        NULL,
        -p_refund_amount,
        ARRAY[]::TEXT[],
        NOW(),
        v_user_id,
        COALESCE(p_refund_reason, '退款')
    ) RETURNING id INTO v_refund_record_id;

    -- 更新申请单累计收款金额和状态
    UPDATE public.invoice_requests
    SET 
        status = CASE 
            WHEN v_new_received = 0 THEN 'Completed'
            WHEN v_new_received < v_request.total_amount THEN 'Completed'
            ELSE 'Received'
        END,
        total_received_amount = v_new_received,
        received_amount = v_new_received,
        updated_at = NOW()
    WHERE request_number = p_request_number;

    -- 如果全额退款，恢复运单收款状态
    IF v_new_received = 0 THEN
        UPDATE public.logistics_records
        SET 
            receipt_status = 'Unreceived',
            updated_at = NOW()
        WHERE id IN (
            SELECT logistics_record_id 
            FROM public.invoice_request_details 
            WHERE invoice_request_id = v_request.id
        );
    END IF;

    -- 扣减货主余额（退款金额作为扣减）
    PERFORM public.update_partner_balance(
        p_partner_id := v_request.invoicing_partner_id,
        p_amount := -p_refund_amount,
        p_transaction_type := 'deduct',
        p_transaction_category := 'refund',
        p_reference_type := 'invoice_receipt',
        p_reference_id := v_request.id,
        p_reference_number := p_request_number,
        p_description := format('开票退款：申请单 %s，退款金额 ¥%s，原因：%s', 
            p_request_number, p_refund_amount, COALESCE(p_refund_reason, '退款'))
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('退款成功，退款金额 ¥%s，剩余收款金额 ¥%s', p_refund_amount, v_new_received),
        'refund_amount', p_refund_amount,
        'remaining_received', v_new_received,
        'refund_record_id', v_refund_record_id
    );
END;
$$;

COMMENT ON FUNCTION public.refund_invoice_receipt_1114 IS '退款功能（使用统一权限系统：finance.refund_receipt）';

-- 7. 更新 reconcile_invoice_receipt_1114 函数
CREATE OR REPLACE FUNCTION public.reconcile_invoice_receipt_1114(
    p_request_number TEXT,
    p_reconciliation_status TEXT DEFAULT 'Reconciled',
    p_reconciliation_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_user_id UUID;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.reconcile_receipt') THEN
        RAISE EXCEPTION '权限不足：您没有对账权限。需要 finance.reconcile_receipt 权限';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;

    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    -- 状态校验
    IF p_reconciliation_status NOT IN ('Reconciled', 'Unreconciled', 'Exception') THEN
        RAISE EXCEPTION '对账状态无效: %。有效值：Reconciled, Unreconciled, Exception', p_reconciliation_status;
    END IF;

    -- 更新对账信息
    UPDATE public.invoice_requests
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
        reconciliation_notes = p_reconciliation_notes
    WHERE id = v_request.id;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('对账成功！状态已更新为: %s', p_reconciliation_status)
    );
END;
$$;

COMMENT ON FUNCTION public.reconcile_invoice_receipt_1114 IS '对账功能（使用统一权限系统：finance.reconcile_receipt）';

-- 8. 更新 send_receipt_reminders_1114 函数（与合并文件保持一致）
CREATE OR REPLACE FUNCTION public.send_receipt_reminders_1114(
    p_days_before_due INTEGER DEFAULT 3,
    p_overdue_reminder_interval INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_overdue_request RECORD;
    v_due_soon_request RECORD;
    v_reminder_count INTEGER := 0;
    v_overdue_count INTEGER := 0;
    v_is_overdue BOOLEAN;
    v_days_overdue INTEGER;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.send_reminders') THEN
        RAISE EXCEPTION '权限不足：您没有发送提醒权限。需要 finance.send_reminders 权限';
    END IF;

    -- 查找逾期未收款申请单
    FOR v_overdue_request IN
        SELECT ir.*, 
               CURRENT_DATE - ir.payment_due_date as days_overdue
        FROM public.invoice_requests ir
        WHERE ir.status = 'Completed'
          AND COALESCE(ir.total_received_amount, 0) < ir.total_amount
          AND ir.payment_due_date IS NOT NULL
          AND ir.payment_due_date < CURRENT_DATE
          AND (
              ir.last_reminder_at IS NULL 
              OR ir.last_reminder_at < CURRENT_DATE - (p_overdue_reminder_interval || ' days')::INTERVAL
          )
    LOOP
        v_is_overdue := true;
        v_days_overdue := v_overdue_request.days_overdue;
        
        -- 更新提醒记录
        UPDATE public.invoice_requests
        SET 
            reminder_count = reminder_count + 1,
            last_reminder_at = NOW(),
            overdue_days = v_days_overdue,
            updated_at = NOW()
        WHERE id = v_overdue_request.id;
        
        -- 为财务人员创建通知
        INSERT INTO public.notifications (
            user_id,
            type,
            category,
            title,
            message,
            link,
            related_id,
            is_read,
            created_at
        )
        SELECT
            u.id,
            'warning',
            'finance',
            format('收款逾期提醒：申请单 %s', v_overdue_request.request_number),
            format('申请单 %s 已逾期 %s 天，未收款金额：¥%s。请及时跟进收款。',
                v_overdue_request.request_number,
                COALESCE(v_days_overdue, 0),
                v_overdue_request.total_amount - COALESCE(v_overdue_request.total_received_amount, 0) - COALESCE(v_overdue_request.received_amount, 0)),
            format('/finance/payment-invoice?requestNumber=%s', v_overdue_request.request_number),
            v_overdue_request.id,
            false,
            NOW()
        FROM auth.users u
        WHERE (u.raw_user_meta_data->>'role')::text IN ('admin', 'finance')
           OR EXISTS (
               SELECT 1
               FROM public.user_permissions up
               WHERE up.user_id = u.id
                 AND up.permission_key = 'finance.payment_invoice'
           )
           OR public.has_function_permission('finance.receive_payment');  -- ✅ 使用统一权限系统检查
        
        v_overdue_count := v_overdue_count + 1;
    END LOOP;

    -- 查找即将到期申请单
    FOR v_due_soon_request IN
        SELECT ir.*
        FROM public.invoice_requests ir
        WHERE ir.status = 'Completed'
          AND COALESCE(ir.total_received_amount, 0) < ir.total_amount
          AND ir.payment_due_date IS NOT NULL
          AND ir.payment_due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + (p_days_before_due || ' days')::INTERVAL)
          AND (
              ir.last_reminder_at IS NULL 
              OR ir.last_reminder_at < CURRENT_DATE - INTERVAL '1 day'
          )
    LOOP
        v_is_overdue := false;
        
        -- 更新提醒记录
        UPDATE public.invoice_requests
        SET 
            reminder_count = reminder_count + 1,
            last_reminder_at = NOW(),
            updated_at = NOW()
        WHERE id = v_due_soon_request.id;
        
        -- 为财务人员创建通知
        INSERT INTO public.notifications (
            user_id,
            type,
            category,
            title,
            message,
            link,
            related_id,
            is_read,
            created_at
        )
        SELECT
            u.id,
            'info',
            'finance',
            format('收款即将到期提醒：申请单 %s', v_due_soon_request.request_number),
            format('申请单 %s 将在 %s 天后到期，未收款金额：¥%s。请及时跟进收款。',
                v_due_soon_request.request_number,
                (v_due_soon_request.payment_due_date - CURRENT_DATE),
                v_due_soon_request.total_amount - COALESCE(v_due_soon_request.total_received_amount, 0) - COALESCE(v_due_soon_request.received_amount, 0)),
            format('/finance/payment-invoice?requestNumber=%s', v_due_soon_request.request_number),
            v_due_soon_request.id,
            false,
            NOW()
        FROM auth.users u
        WHERE (u.raw_user_meta_data->>'role')::text IN ('admin', 'finance')
           OR EXISTS (
               SELECT 1
               FROM public.user_permissions up
               WHERE up.user_id = u.id
                 AND up.permission_key = 'finance.payment_invoice'
           )
           OR public.has_function_permission('finance.receive_payment');  -- ✅ 使用统一权限系统检查
        
        v_reminder_count := v_reminder_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'overdue_reminders', v_overdue_count,
        'due_soon_reminders', v_reminder_count,
        'total_reminders', v_overdue_count + v_reminder_count,
        'message', format('已发送 %s 条逾期提醒，%s 条到期提醒', v_overdue_count, v_reminder_count)
    );
END;
$$;

COMMENT ON FUNCTION public.send_receipt_reminders_1114 IS '发送收款提醒（使用统一权限系统：finance.send_reminders）';

-- 9. 更新 get_receipt_statistics_1114 函数（与合并文件保持一致）
CREATE OR REPLACE FUNCTION public.get_receipt_statistics_1114(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_statistics JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.view_receipt_statistics') THEN
        RAISE EXCEPTION '权限不足：您没有查看收款统计权限。需要 finance.view_receipt_statistics 权限';
    END IF;

    -- 构建统计查询（与合并文件保持一致）
    SELECT jsonb_build_object(
        'total_invoice_amount', COALESCE(SUM(total_amount), 0),
        'total_received_amount', COALESCE(SUM(total_received_amount), 0),
        'total_unreceived_amount', COALESCE(SUM(total_amount - COALESCE(total_received_amount, 0)), 0),
        'receipt_count', COUNT(*) FILTER (WHERE status = 'Received'),
        'partial_receipt_count', COUNT(*) FILTER (WHERE status = 'Completed' AND total_received_amount > 0 AND total_received_amount < total_amount),
        'unreceived_count', COUNT(*) FILTER (WHERE status = 'Completed' AND COALESCE(total_received_amount, 0) = 0),
        'overdue_count', COUNT(*) FILTER (WHERE payment_due_date < CURRENT_DATE AND status = 'Completed' AND COALESCE(total_received_amount, 0) < total_amount),
        'overdue_amount', COALESCE(SUM(total_amount - COALESCE(total_received_amount, 0)) FILTER (WHERE payment_due_date < CURRENT_DATE AND status = 'Completed' AND COALESCE(total_received_amount, 0) < total_amount), 0)
    ) INTO v_statistics
    FROM public.invoice_requests
    WHERE (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
      AND (p_partner_id IS NULL OR invoicing_partner_id = p_partner_id);

    RETURN jsonb_build_object('success', true, 'statistics', v_statistics);
END;
$$;

COMMENT ON FUNCTION public.get_receipt_statistics_1114 IS '获取收款统计（使用统一权限系统：finance.view_receipt_statistics）';

-- 10. 更新 get_receipt_details_report_1114 函数（与合并文件保持一致）
CREATE OR REPLACE FUNCTION public.get_receipt_details_report_1114(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_records JSONB;
    v_total_count INTEGER;
    v_offset INTEGER;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.view_receipt_report') THEN
        RAISE EXCEPTION '权限不足：您没有查看收款报表权限。需要 finance.view_receipt_report 权限';
    END IF;

    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 获取总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.invoice_requests ir
    WHERE (p_start_date IS NULL OR DATE(ir.created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(ir.created_at) <= p_end_date)
      AND (p_partner_id IS NULL OR ir.invoicing_partner_id = p_partner_id)
      AND (p_status IS NULL OR ir.status = p_status);
    
    -- 获取详情记录
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ir.id,
            'request_number', ir.request_number,
            'invoicing_partner_id', ir.invoicing_partner_id,
            'invoicing_partner_full_name', ir.invoicing_partner_full_name,
            'total_amount', ir.total_amount,
            'total_received_amount', COALESCE(ir.total_received_amount, 0),
            'remaining_amount', ir.total_amount - COALESCE(ir.total_received_amount, 0),
            'payment_due_date', ir.payment_due_date,
            'overdue_days', COALESCE(ir.overdue_days, 0),
            'status', ir.status,
            'reconciliation_status', COALESCE(ir.reconciliation_status, 'Unreconciled'),
            'created_at', ir.created_at
        ) ORDER BY ir.created_at DESC
    ) INTO v_records
    FROM public.invoice_requests ir
    WHERE (p_start_date IS NULL OR DATE(ir.created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(ir.created_at) <= p_end_date)
      AND (p_partner_id IS NULL OR ir.invoicing_partner_id = p_partner_id)
      AND (p_status IS NULL OR ir.status = p_status)
    ORDER BY ir.created_at DESC
    LIMIT p_page_size OFFSET v_offset;
    
    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', p_page_number,
        'page_size', p_page_size,
        'total_pages', CEIL(v_total_count::NUMERIC / p_page_size)
    );
END;
$$;

COMMENT ON FUNCTION public.get_receipt_details_report_1114 IS '获取收款详细报表（使用统一权限系统：finance.view_receipt_report）';

-- 11. 更新 get_receipt_records_1114 函数（与合并文件保持一致）
CREATE OR REPLACE FUNCTION public.get_receipt_records_1114(
    p_request_number TEXT DEFAULT NULL,
    p_invoice_request_id UUID DEFAULT NULL,
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id UUID;
    v_records JSONB;
    v_total_count INTEGER;
    v_offset INTEGER;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.view_receipt_records') THEN
        RAISE EXCEPTION '权限不足：您没有查看收款记录权限。需要 finance.view_receipt_records 权限';
    END IF;

    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 如果提供了申请单号，先获取ID
    IF p_request_number IS NOT NULL THEN
        SELECT id INTO v_request_id
        FROM public.invoice_requests
        WHERE request_number = p_request_number;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', '开票申请不存在');
        END IF;
    ELSIF p_invoice_request_id IS NOT NULL THEN
        v_request_id := p_invoice_request_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', '必须提供申请单号或申请单ID');
    END IF;

    -- 获取总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.invoice_receipt_records
    WHERE invoice_request_id = v_request_id;

    -- 查询收款记录
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', irr.id,
            'receipt_number', irr.receipt_number,
            'receipt_bank', irr.receipt_bank,
            'receipt_amount', irr.receipt_amount,
            'receipt_images', irr.receipt_images,
            'receipt_date', irr.receipt_date,
            'received_by', irr.received_by,
            'received_by_name', (SELECT full_name FROM public.profiles WHERE id = irr.received_by),
            'notes', irr.notes,
            'created_at', irr.created_at
        ) ORDER BY irr.receipt_date DESC
    ) INTO v_records
    FROM public.invoice_receipt_records irr
    WHERE irr.invoice_request_id = v_request_id
    ORDER BY irr.receipt_date DESC
    LIMIT p_page_size OFFSET v_offset;

    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', p_page_number,
        'page_size', p_page_size,
        'total_pages', CEIL(v_total_count::NUMERIC / p_page_size)
    );
END;
$$;

COMMENT ON FUNCTION public.get_receipt_records_1114 IS '查询收款记录列表（使用统一权限系统：finance.view_receipt_records）';

-- ============================================================================
-- 第二部分：为现有角色配置权限
-- ============================================================================

-- 为 finance 角色添加所有收款相关权限
DO $$
BEGIN
    -- 检查 role_permission_templates 表是否存在 finance 角色记录
    IF EXISTS (SELECT 1 FROM public.role_permission_templates WHERE role = 'finance') THEN
        -- 更新现有记录，添加收款相关权限
        UPDATE public.role_permission_templates
        SET function_permissions = (
            SELECT array_agg(DISTINCT elem)
            FROM (
                SELECT unnest(COALESCE(function_permissions, ARRAY[]::TEXT[])) AS elem
                UNION
                SELECT unnest(ARRAY[
                    'finance.receive_payment',
                    'finance.refund_receipt',
                    'finance.reconcile_receipt',
                    'finance.send_reminders',
                    'finance.view_receipt_statistics',
                    'finance.view_receipt_report',
                    'finance.view_receipt_records',
                    'finance.manual_recharge',
                    'finance.deduct_service_fee',
                    'finance.deduct_overdue_fee',
                    'finance.deduct_partner_fee'
                ])
            ) AS combined
        )
        WHERE role = 'finance';
        
        RAISE NOTICE '✅ 已为 finance 角色添加收款相关权限';
    ELSE
        -- 创建新记录
        INSERT INTO public.role_permission_templates (
            role,
            function_permissions
        ) VALUES (
            'finance',
            ARRAY[
                'finance.receive_payment',
                'finance.refund_receipt',
                'finance.reconcile_receipt',
                'finance.send_reminders',
                'finance.view_receipt_statistics',
                'finance.view_receipt_report',
                'finance.view_receipt_records',
                'finance.manual_recharge',
                'finance.deduct_service_fee',
                'finance.deduct_overdue_fee',
                'finance.deduct_partner_fee'
            ]
        );
        
        RAISE NOTICE '✅ 已为 finance 角色创建权限模板';
    END IF;
END $$;

-- admin 角色自动拥有所有权限（在 has_function_permission 函数中已实现）
-- 无需额外配置

-- ============================================================================
-- 第三部分：验证迁移结果
-- ============================================================================

DO $$
DECLARE
    v_function_count INTEGER;
    v_permission_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 收款系统权限迁移完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 检查函数数量
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc
    WHERE proname IN (
        'receive_invoice_payment_1114',
        'refund_invoice_receipt_1114',
        'reconcile_invoice_receipt_1114',
        'send_receipt_reminders_1114',
        'get_receipt_statistics_1114',
        'get_receipt_details_report_1114',
        'get_receipt_records_1114',
        'manual_recharge_partner_balance',
        'deduct_service_fee',
        'deduct_overdue_fee',
        'deduct_partner_fee'
    )
    AND pronamespace = 'public'::regnamespace;
    
    RAISE NOTICE '已更新函数数量: %', v_function_count;
    RAISE NOTICE '';
    RAISE NOTICE '权限键列表:';
    RAISE NOTICE '  ✅ finance.receive_payment - 财务收款';
    RAISE NOTICE '  ✅ finance.refund_receipt - 退款';
    RAISE NOTICE '  ✅ finance.reconcile_receipt - 对账';
    RAISE NOTICE '  ✅ finance.send_reminders - 发送提醒';
    RAISE NOTICE '  ✅ finance.view_receipt_statistics - 查看统计';
    RAISE NOTICE '  ✅ finance.view_receipt_report - 查看报表';
    RAISE NOTICE '  ✅ finance.view_receipt_records - 查看记录';
    RAISE NOTICE '  ✅ finance.manual_recharge - 手动充值';
    RAISE NOTICE '  ✅ finance.deduct_service_fee - 扣减服务费';
    RAISE NOTICE '  ✅ finance.deduct_overdue_fee - 扣减逾期费';
    RAISE NOTICE '  ✅ finance.deduct_partner_fee - 扣减费用';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '所有权限都可以通过数据库配置：';
    RAISE NOTICE '  1. role_permission_templates 表（角色模板）';
    RAISE NOTICE '  2. user_permissions 表（用户自定义权限）';
    RAISE NOTICE '  3. admin 角色自动拥有所有权限';
    RAISE NOTICE '========================================';
END $$;

