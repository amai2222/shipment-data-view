-- ============================================================================
-- 将所有硬编码的权限检查替换为统一权限系统（_1126版本）
-- ============================================================================
-- 问题：数据库函数中使用硬编码的角色检查（如 is_finance_or_admin()），
--      没有使用系统的统一权限管理系统
-- 解决：将所有硬编码的权限检查替换为 has_function_permission() 函数
-- ============================================================================
-- 创建时间: 2025-11-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. approve_invoice_request_v2_1126 - 审批开票申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_invoice_request_v2_1126(p_request_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request record;
    v_record_ids UUID[];
    v_updated_count INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
    -- 检查功能权限：finance.approve_invoice
    IF NOT public.has_function_permission('finance.approve_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有审批开票申请的权限。请联系管理员在权限管理中分配 "finance.approve_invoice" 权限。';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    IF v_request.status != 'Pending' THEN
        RAISE EXCEPTION '只能审批待审核状态的申请，当前状态: %', v_request.status;
    END IF;

    -- 获取关联的运单ID
    SELECT ARRAY_AGG(DISTINCT logistics_record_id)
    INTO v_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = v_request.id;

    -- 1. 更新申请单状态
    UPDATE public.invoice_requests 
    SET 
        status = 'Approved',
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE request_number = p_request_number;

    -- 2. 更新运单开票状态：Processing -> Approved
    IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET invoice_status = 'Approved'
        WHERE id = ANY(v_record_ids)
          AND invoice_status = 'Processing';
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 3. 更新合作方成本开票状态
    UPDATE public.logistics_partner_costs
    SET invoice_status = 'Approved'
    WHERE invoice_request_id = v_request.id
      AND invoice_status = 'Processing';

    RETURN jsonb_build_object(
        'success', true,
        'message', format('开票申请已审批通过，%s条运单状态已更新为"开票审核通过"', v_updated_count),
        'request_number', p_request_number,
        'updated_count', v_updated_count
    );
END;
$function$;

COMMENT ON FUNCTION public.approve_invoice_request_v2_1126 IS '审批开票申请（使用统一权限系统检查权限：has_function_permission(''finance.approve_invoice'')）';

-- ============================================================================
-- 2. batch_approve_invoice_requests_1126 - 批量审批开票申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_approve_invoice_requests_1126(p_request_numbers text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_number TEXT;
    v_success_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_total_waybills INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
BEGIN
    -- ✅ 使用统一权限系统检查权限
    IF NOT public.has_function_permission('finance.approve_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有批量审批开票申请的权限。请联系管理员在权限管理中分配 "finance.approve_invoice" 权限。';
    END IF;

    -- 遍历每个申请单号
    FOREACH v_request_number IN ARRAY p_request_numbers
    LOOP
        BEGIN
            DECLARE
                v_result JSONB;
            BEGIN
                -- 调用单个审批函数（使用新版本）
                v_result := public.approve_invoice_request_v2_1126(v_request_number);
                
                IF (v_result->>'success')::BOOLEAN THEN
                    v_success_count := v_success_count + 1;
                    v_total_waybills := v_total_waybills + COALESCE((v_result->>'updated_count')::INTEGER, 0);
                ELSE
                    v_failed_count := v_failed_count + 1;
                    v_failed_requests := array_append(v_failed_requests, v_request_number);
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            -- 单个审批失败不影响其他
            v_failed_count := v_failed_count + 1;
            v_failed_requests := array_append(v_failed_requests, v_request_number);
            RAISE NOTICE '审批申请单 % 失败: %', v_request_number, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('批量审批完成：成功 %s 个，失败 %s 个，共更新 %s 条运单', 
                         v_success_count, v_failed_count, v_total_waybills),
        'success_count', v_success_count,
        'failed_count', v_failed_count,
        'total_waybills', v_total_waybills,
        'failed_requests', v_failed_requests
    );
END;
$function$;

COMMENT ON FUNCTION public.batch_approve_invoice_requests_1126 IS '批量审批开票申请（使用统一权限系统检查权限：has_function_permission(''finance.approve_invoice'')）';

-- ============================================================================
-- 3. complete_invoice_request_v2_1126 - 完成开票
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_invoice_request_v2_1126(p_request_number text, p_invoice_number text DEFAULT NULL::text, p_invoice_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request record;
    v_record_ids UUID[];
    v_updated_count INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限
    IF NOT public.has_function_permission('finance.complete_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有完成开票的权限。请联系管理员在权限管理中分配 "finance.complete_invoice" 权限。';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    IF v_request.status != 'Approved' THEN
        RAISE EXCEPTION '只能完成已审批待开票状态的申请，当前状态: %', v_request.status;
    END IF;

    -- 获取关联的运单ID
    SELECT ARRAY_AGG(DISTINCT logistics_record_id)
    INTO v_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = v_request.id;

    -- 1. 更新申请单状态为Completed
    UPDATE public.invoice_requests 
    SET 
        status = 'Completed',
        invoice_number = COALESCE(p_invoice_number, invoice_number),
        invoice_date = COALESCE(p_invoice_date, invoice_date, CURRENT_DATE),
        updated_at = NOW()
    WHERE request_number = p_request_number;

    -- 2. 更新运单开票状态：Approved -> Invoiced
    IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Invoiced',
            invoice_completed_at = NOW()
        WHERE id = ANY(v_record_ids)
          AND invoice_status = 'Approved';
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 3. 更新合作方成本开票状态
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Invoiced',
        invoice_number = COALESCE(p_invoice_number, invoice_number),
        invoice_completed_at = NOW()
    WHERE invoice_request_id = v_request.id
      AND invoice_status = 'Approved';

    RETURN jsonb_build_object(
        'success', true,
        'message', format('开票完成，%s条运单状态已更新为"已开票"', v_updated_count),
        'request_number', p_request_number,
        'updated_count', v_updated_count,
        'invoice_number', COALESCE(p_invoice_number, v_request.invoice_number)
    );
END;
$function$;

COMMENT ON FUNCTION public.complete_invoice_request_v2_1126 IS '完成开票（使用统一权限系统检查权限：has_function_permission(''finance.complete_invoice'')）';

-- ============================================================================
-- 4. batch_complete_invoice_requests_1126 - 批量完成开票
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_complete_invoice_requests_1126(p_request_numbers text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_number TEXT;
    v_success_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_total_waybills INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
BEGIN
    -- ✅ 使用统一权限系统检查权限
    IF NOT public.has_function_permission('finance.complete_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有批量完成开票的权限。请联系管理员在权限管理中分配 "finance.complete_invoice" 权限。';
    END IF;

    -- 遍历每个申请单号
    FOREACH v_request_number IN ARRAY p_request_numbers
    LOOP
        BEGIN
            DECLARE
                v_result JSONB;
            BEGIN
                -- 调用单个开票函数（使用新版本）
                v_result := public.complete_invoice_request_v2_1126(v_request_number);
                
                IF (v_result->>'success')::BOOLEAN THEN
                    v_success_count := v_success_count + 1;
                    v_total_waybills := v_total_waybills + COALESCE((v_result->>'updated_count')::INTEGER, 0);
                ELSE
                    v_failed_count := v_failed_count + 1;
                    v_failed_requests := array_append(v_failed_requests, v_request_number);
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            -- 单个开票失败不影响其他
            v_failed_count := v_failed_count + 1;
            v_failed_requests := array_append(v_failed_requests, v_request_number);
            RAISE NOTICE '开票申请单 % 失败: %', v_request_number, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('批量开票完成：成功 %s 个，失败 %s 个，共更新 %s 条运单', 
                         v_success_count, v_failed_count, v_total_waybills),
        'success_count', v_success_count,
        'failed_count', v_failed_count,
        'total_waybills', v_total_waybills,
        'failed_requests', v_failed_requests
    );
END;
$function$;

COMMENT ON FUNCTION public.batch_complete_invoice_requests_1126 IS '批量完成开票（使用统一权限系统检查权限：has_function_permission(''finance.complete_invoice'')）';

-- ============================================================================
-- 5. cancel_invoice_request_1126 - 取消开票
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_invoice_request_1126(p_request_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request record;
    v_record_ids UUID[];
    v_updated_count INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限
    IF NOT public.has_function_permission('finance.cancel_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有取消开票的权限。请联系管理员在权限管理中分配 "finance.cancel_invoice" 权限。';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    IF v_request.status != 'Completed' THEN
        RAISE EXCEPTION '只能取消已开票状态的申请，当前状态: %', v_request.status;
    END IF;

    -- 获取关联的运单ID
    SELECT ARRAY_AGG(DISTINCT logistics_record_id)
    INTO v_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = v_request.id;

    -- 1. 更新申请单状态：Completed -> Approved
    UPDATE public.invoice_requests 
    SET 
        status = 'Approved',
        updated_at = NOW(),
        remarks = COALESCE(remarks, '') || ' [开票已取消]'
    WHERE request_number = p_request_number;

    -- 2. 更新运单开票状态：Invoiced -> Approved
    IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Approved',
            invoice_completed_at = NULL
        WHERE id = ANY(v_record_ids)
          AND invoice_status = 'Invoiced';
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 3. 更新合作方成本开票状态
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Approved',
        invoice_completed_at = NULL
    WHERE invoice_request_id = v_request.id
      AND invoice_status = 'Invoiced';

    RETURN jsonb_build_object(
        'success', true,
        'message', format('开票已取消，%s条运单状态已回退到"开票审核通过"', v_updated_count),
        'request_number', p_request_number,
        'updated_count', v_updated_count
    );
END;
$function$;

COMMENT ON FUNCTION public.cancel_invoice_request_1126 IS '取消开票（使用统一权限系统检查权限：has_function_permission(''finance.cancel_invoice'')）';

-- ============================================================================
-- 6. batch_cancel_invoice_requests_1126 - 批量取消开票
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_cancel_invoice_requests_1126(p_request_numbers text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_number TEXT;
    v_success_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_total_waybills INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
BEGIN
    -- ✅ 使用统一权限系统检查权限
    IF NOT public.has_function_permission('finance.cancel_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有批量取消开票的权限。请联系管理员在权限管理中分配 "finance.cancel_invoice" 权限。';
    END IF;

    -- 遍历每个申请单号
    FOREACH v_request_number IN ARRAY p_request_numbers
    LOOP
        BEGIN
            DECLARE
                v_result JSONB;
            BEGIN
                -- 调用单个取消开票函数（使用新版本）
                v_result := public.cancel_invoice_request_1126(v_request_number);
                
                IF (v_result->>'success')::BOOLEAN THEN
                    v_success_count := v_success_count + 1;
                    v_total_waybills := v_total_waybills + COALESCE((v_result->>'updated_count')::INTEGER, 0);
                ELSE
                    v_failed_count := v_failed_count + 1;
                    v_failed_requests := array_append(v_failed_requests, v_request_number);
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            -- 单个取消失败不影响其他
            v_failed_count := v_failed_count + 1;
            v_failed_requests := array_append(v_failed_requests, v_request_number);
            RAISE NOTICE '取消开票申请单 % 失败: %', v_request_number, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('批量取消开票完成：成功 %s 个，失败 %s 个，共回退 %s 条运单', 
                         v_success_count, v_failed_count, v_total_waybills),
        'success_count', v_success_count,
        'failed_count', v_failed_count,
        'total_waybills', v_total_waybills,
        'failed_requests', v_failed_requests
    );
END;
$function$;

COMMENT ON FUNCTION public.batch_cancel_invoice_requests_1126 IS '批量取消开票（使用统一权限系统检查权限：has_function_permission(''finance.cancel_invoice'')）';

-- ============================================================================
-- 7. batch_approve_payment_requests_1126 - 批量审批付款申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_approve_payment_requests_1126(p_request_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_id TEXT;
    v_approved_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
    v_result JSONB;
    v_record_ids UUID[];
    v_notified_count INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限
    IF NOT public.has_function_permission('finance.approve_payment') THEN
        RAISE EXCEPTION '权限不足：您没有批量审批付款申请的权限。请联系管理员在权限管理中分配 "finance.approve_payment" 权限。';
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
$function$;

COMMENT ON FUNCTION public.batch_approve_payment_requests_1126 IS '批量审批付款申请（使用统一权限系统检查权限：has_function_permission(''finance.approve_payment'')）';

-- ============================================================================
-- 8. batch_modify_partner_cost_1126 - 批量修改合作方成本
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_modify_partner_cost_1126(p_record_ids uuid[], p_new_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_records TEXT[] := '{}';
    v_highest_partner RECORD;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_operator_or_admin()）
    IF NOT public.has_function_permission('data.modify_cost') THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：您没有批量修改合作方成本的权限。请联系管理员在权限管理中分配 "data.modify_cost" 权限。'
        );
    END IF;
    
    -- 遍历每个运单
    FOREACH v_record_id IN ARRAY p_record_ids
    LOOP
        BEGIN
            -- 检查运单状态
            DECLARE
                v_payment_status TEXT;
                v_invoice_status TEXT;
                v_auto_number TEXT;
            BEGIN
                SELECT payment_status, invoice_status, auto_number
                INTO v_payment_status, v_invoice_status, v_auto_number
                FROM public.logistics_records
                WHERE id = v_record_id;
                
                -- 检查付款状态
                IF v_payment_status != 'Unpaid' THEN
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(v_failed_records, v_auto_number || '(已申请或已付款)');
                    CONTINUE;
                END IF;
                
                -- 检查开票状态
                IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(v_failed_records, v_auto_number || '(已开票)');
                    CONTINUE;
                END IF;
                
                -- 获取最高级合作方
                SELECT partner_id, level
                INTO v_highest_partner
                FROM public.logistics_partner_costs
                WHERE logistics_record_id = v_record_id
                ORDER BY level DESC
                LIMIT 1;
                
                IF v_highest_partner.partner_id IS NULL THEN
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(v_failed_records, v_auto_number || '(无合作方)');
                    CONTINUE;
                END IF;
                
                -- 更新最高级合作方的金额
                UPDATE public.logistics_partner_costs
                SET 
                    payable_amount = p_new_amount,
                    updated_at = NOW()
                WHERE logistics_record_id = v_record_id
                AND partner_id = v_highest_partner.partner_id
                AND level = v_highest_partner.level;
                
                v_updated_count := v_updated_count + 1;
            END;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_records := array_append(v_failed_records, v_auto_number || '(错误)');
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'failed_count', v_failed_count,
        'failed_records', v_failed_records,
        'message', format('成功更新 %s 条运单，失败 %s 条', v_updated_count, v_failed_count)
    );
END;
$function$;

COMMENT ON FUNCTION public.batch_modify_partner_cost_1126 IS '批量修改合作方成本（使用统一权限系统检查权限：has_function_permission(''data.modify_cost'')）';

-- ============================================================================
-- 9. modify_logistics_record_chain_with_recalc_1126 - 修改运单合作链路（含成本重算）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain_with_recalc_1126(p_record_id uuid, p_chain_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_project_id UUID;
    v_chain_id UUID;
    v_old_chain_name TEXT;
    v_payment_status TEXT;
    v_invoice_status TEXT;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_inserted_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_manually_modified_costs JSONB;
    v_manual_value NUMERIC;
    v_is_manual BOOLEAN;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_operator_or_admin()）
    IF NOT public.has_function_permission('data.modify_chain') THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：您没有修改合作链路的权限。请联系管理员在权限管理中分配 "data.modify_chain" 权限。'
        );
    END IF;
    
    -- 获取运单信息
    SELECT 
        lr.project_id, 
        pc.chain_name,
        lr.current_cost + COALESCE(lr.extra_cost, 0),
        lr.loading_weight,
        lr.unloading_weight,
        lr.payment_status,
        lr.invoice_status
    INTO 
        v_project_id, 
        v_old_chain_name, 
        v_base_amount,
        v_loading_weight,
        v_unloading_weight,
        v_payment_status,
        v_invoice_status
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE lr.id = p_record_id;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '运单记录不存在'
        );
    END IF;
    
    -- 检查支付状态
    IF v_payment_status != 'Unpaid' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未支付状态的运单才能修改合作链路'
        );
    END IF;
    
    -- 检查开票状态
    IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未开票状态的运单才能修改合作链路'
        );
    END IF;
    
    -- 查找新的合作链路ID
    SELECT id INTO v_chain_id
    FROM public.partner_chains
    WHERE project_id = v_project_id
    AND chain_name = p_chain_name
    LIMIT 1;
    
    IF v_chain_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '指定的合作链路不存在'
        );
    END IF;
    
    -- ✅ 关键修复：保存所有手动修改的成本（按partner_id + level匹配）
    SELECT json_agg(
        json_build_object(
            'partner_id', partner_id,
            'level', level,
            'payable_amount', payable_amount
        )
    )
    INTO v_manually_modified_costs
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id
    AND is_manually_modified = true;
    
    RAISE NOTICE '📌 保存手动修改的成本：%', COALESCE(jsonb_array_length(v_manually_modified_costs), 0);
    
    -- 删除旧成本记录
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;
    
    -- 更新链路
    UPDATE public.logistics_records
    SET 
        chain_id = v_chain_id,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 重新计算并插入合作方成本
    FOR v_project_partners IN
        SELECT 
            pp.partner_id,
            pp.level,
            pp.calculation_method,
            pp.tax_rate,
            pp.profit_rate
        FROM public.project_partners pp
        WHERE pp.project_id = v_project_id
        AND pp.chain_id = v_chain_id
        ORDER BY pp.level ASC
    LOOP
        -- 初始值：按系统规则计算
        IF v_project_partners.calculation_method = 'profit' THEN
            IF v_loading_weight IS NOT NULL AND v_loading_weight > 0 THEN
                v_payable_amount := v_base_amount + (COALESCE(v_project_partners.profit_rate, 0) * v_loading_weight);
            ELSE
                v_payable_amount := v_base_amount + COALESCE(v_project_partners.profit_rate, 0);
            END IF;
        ELSE
            -- 税点法
            IF v_project_partners.tax_rate IS NOT NULL AND v_project_partners.tax_rate != 1 THEN
                v_payable_amount := v_base_amount / (1 - v_project_partners.tax_rate);
            ELSE
                v_payable_amount := v_base_amount;
            END IF;
        END IF;
        
        -- ✅ 关键修复：检查该合作方是否有手动修改的值
        v_manual_value := NULL;
        v_is_manual := false;
        
        IF v_manually_modified_costs IS NOT NULL THEN
            SELECT (elem->>'payable_amount')::NUMERIC
            INTO v_manual_value
            FROM jsonb_array_elements(v_manually_modified_costs) AS elem
            WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
            AND (elem->>'level')::INTEGER = v_project_partners.level
            LIMIT 1;
            
            IF v_manual_value IS NOT NULL THEN
                v_payable_amount := v_manual_value;
                v_is_manual := true;
                v_protected_count := v_protected_count + 1;
                RAISE NOTICE '✅ 保护手动值：合作方(level=%) 恢复为 ¥%', v_project_partners.level, v_manual_value;
            END IF;
        END IF;
        
        -- 插入成本记录
        INSERT INTO public.logistics_partner_costs (
            logistics_record_id,
            partner_id,
            level,
            base_amount,
            payable_amount,
            tax_rate,
            user_id,
            is_manually_modified
        ) VALUES (
            p_record_id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,
            v_payable_amount,
            v_project_partners.tax_rate,
            auth.uid(),
            v_is_manual
        );
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', format('链路修改成功，重算%s个合作方，保护%s个手动值', v_inserted_count, v_protected_count),
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count,
        'protected_manual_costs', v_protected_count
    );
END;
$function$;

COMMENT ON FUNCTION public.modify_logistics_record_chain_with_recalc_1126 IS '修改运单合作链路（含成本重算，使用统一权限系统检查权限：has_function_permission(''data.modify_chain'')）';

COMMIT;

-- ============================================================================
-- 说明：
-- 1. 所有函数都已重命名为 _1126 后缀
-- 2. 所有硬编码的权限检查都已替换为 has_function_permission() 函数
-- 3. 权限键映射：
--    - finance.approve_invoice - 审批开票申请
--    - finance.complete_invoice - 完成开票
--    - finance.cancel_invoice - 取消开票
--    - finance.approve_payment - 审批付款申请
--    - data.modify_cost - 修改合作方成本
--    - data.modify_chain - 修改合作链路
-- 4. 批量函数内部调用已更新为使用新版本的单个函数
-- 5. 错误消息已更新，指向权限管理系统
-- ============================================================================

