-- ============================================================================
-- 将7个硬编码权限检查的函数替换为统一权限系统（_1126版本）
-- ============================================================================
-- 问题：数据库函数中使用硬编码的角色检查（如 is_finance_or_admin()），
--      没有使用系统的统一权限管理系统
-- 解决：将所有硬编码的权限检查替换为 has_function_permission() 函数
-- ============================================================================
-- 创建时间: 2025-11-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. batch_rollback_invoice_approval_1126 - 批量回滚开票审批
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_rollback_invoice_approval_1126(p_request_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_id UUID;
    v_rollback_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_requests UUID[] := '{}';
    v_not_approved_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin_for_invoice()）
    -- 检查功能权限：finance.rollback_invoice_approval
    IF NOT public.has_function_permission('finance.rollback_invoice_approval') THEN
        RAISE EXCEPTION '权限不足：您没有批量取消审批开票申请的权限。请联系管理员在权限管理中分配 "finance.rollback_invoice_approval" 权限。';
    END IF;

    -- 检查是否有申请单ID
    IF p_request_ids IS NULL OR array_length(p_request_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '未提供申请单ID'
        );
    END IF;

    -- 遍历每个申请单ID
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        BEGIN
            -- 检查申请单状态
            IF EXISTS (
                SELECT 1 FROM public.invoice_requests 
                WHERE id = v_request_id AND status = 'Approved'
            ) THEN
                -- 回滚状态为待审核
                UPDATE public.invoice_requests
                SET 
                    status = 'Pending',
                    updated_at = NOW(),
                    remarks = COALESCE(remarks, '') || ' [批量取消审批]'
                WHERE id = v_request_id AND status = 'Approved';
                
                v_rollback_count := v_rollback_count + 1;
            ELSE
                -- 统计不是已审批状态的申请单
                IF EXISTS (
                    SELECT 1 FROM public.invoice_requests 
                    WHERE id = v_request_id
                ) THEN
                    v_not_approved_count := v_not_approved_count + 1;
                ELSE
                    v_failed_count := v_failed_count + 1;
                    v_failed_requests := array_append(v_failed_requests, v_request_id);
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_requests := array_append(v_failed_requests, v_request_id);
            RAISE WARNING '回滚申请单 % 失败: %', v_request_id, SQLERRM;
        END;
    END LOOP;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'rollback_count', v_rollback_count,
        'failed_count', v_failed_count,
        'not_approved_count', v_not_approved_count,
        'failed_requests', v_failed_requests,
        'message', format('批量取消审批完成：成功 %s 个，失败 %s 个，非已审批状态 %s 个', 
                         v_rollback_count, v_failed_count, v_not_approved_count)
    );

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.batch_rollback_invoice_approval_1126 IS '批量回滚开票审批（使用统一权限系统）';

-- ============================================================================
-- 2. void_and_delete_invoice_requests_1126 - 批量作废并删除开票申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_and_delete_invoice_requests_1126(p_request_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_id UUID;
    v_logistics_record_ids UUID[];
    v_all_logistics_ids UUID[] := '{}';
    v_deleted_count INTEGER := 0;
    v_partner_costs_count INTEGER := 0;
    v_logistics_records_count INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin_for_invoice()）
    -- 检查功能权限：finance.void_invoice
    IF NOT public.has_function_permission('finance.void_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有作废开票申请单的权限。请联系管理员在权限管理中分配 "finance.void_invoice" 权限。';
    END IF;
    
    -- 遍历每个申请单
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        -- 获取该申请单关联的所有运单ID
        SELECT array_agg(DISTINCT logistics_record_id)
        INTO v_logistics_record_ids
        FROM public.invoice_request_details
        WHERE invoice_request_id = v_request_id;
        
        -- 收集所有运单ID
        IF v_logistics_record_ids IS NOT NULL THEN
            v_all_logistics_ids := v_all_logistics_ids || v_logistics_record_ids;
        END IF;
        
        -- 回滚 logistics_partner_costs 状态
        UPDATE public.logistics_partner_costs
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE invoice_request_id = v_request_id;
        
        v_partner_costs_count := v_partner_costs_count + (SELECT COUNT(*) FROM public.logistics_partner_costs WHERE invoice_request_id = v_request_id);
        
        -- 删除开票申请明细
        DELETE FROM public.invoice_request_details
        WHERE invoice_request_id = v_request_id;
        
        -- 删除开票申请记录
        DELETE FROM public.invoice_requests
        WHERE id = v_request_id;
        
        v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    -- 回滚所有相关运单的状态（清理所有开票相关字段）
    IF array_length(v_all_logistics_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL,
            invoice_completed_at = NULL,  -- ✅ 清理完成时间
            invoice_number = NULL  -- ✅ 清理发票号码
        WHERE id = ANY(v_all_logistics_ids);
        
        GET DIAGNOSTICS v_logistics_records_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '开票申请单已删除，运单状态已回滚',
        'deleted_requests', v_deleted_count,
        'affected_partner_costs', v_partner_costs_count,
        'affected_logistics_records', v_logistics_records_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '删除开票申请单失败: ' || SQLERRM
    );
END;
$function$;

COMMENT ON FUNCTION public.void_and_delete_invoice_requests_1126 IS '批量作废并删除开票申请（使用统一权限系统）';

-- ============================================================================
-- 3. void_invoice_request_1126 - 作废开票申请（保留记录）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_invoice_request_1126(p_request_id uuid, p_void_reason text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request record;
    v_affected_count integer;
    v_logistics_record_ids uuid[];
    v_partner_costs_count integer;
    v_logistics_records_count integer;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin_for_invoice()）
    -- 检查功能权限：finance.void_invoice
    IF NOT public.has_function_permission('finance.void_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有作废开票申请单的权限。请联系管理员在权限管理中分配 "finance.void_invoice" 权限。';
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
$function$;

COMMENT ON FUNCTION public.void_invoice_request_1126 IS '作废开票申请（保留记录，使用统一权限系统）';

-- ============================================================================
-- 4. process_payment_application_1126 - 创建付款申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_payment_application_1126(p_record_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_request_id UUID;
    v_request_number TEXT;
    v_record_count INTEGER;
    v_updated_partner_costs INTEGER := 0;
    v_updated_records INTEGER := 0;
    v_rec_id UUID;
    v_rec_max_level INTEGER;
    v_temp_count INTEGER;
    v_notes_parts TEXT[] := '{}';  -- ✅ 移到外部声明
    v_partner_info RECORD;         -- ✅ 移到外部声明
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_operator_or_admin()）
    -- 检查功能权限：finance.create_payment_request
    IF NOT public.has_function_permission('finance.create_payment_request') THEN
        RAISE EXCEPTION '权限不足：您没有创建付款申请的权限。请联系管理员在权限管理中分配 "finance.create_payment_request" 权限。';
    END IF;
    
    -- 生成付款申请单编号
    v_request_number := 'FKD' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- 生成备注：收集所有需要付款的供应商信息
    -- 按供应商分组统计
    FOR v_partner_info IN
        WITH record_max_levels AS (
            SELECT 
                logistics_record_id, 
                MAX(level) as max_level,
                COUNT(*) as cost_count
            FROM public.logistics_partner_costs
            WHERE logistics_record_id = ANY(p_record_ids)
            GROUP BY logistics_record_id
        ),
        record_payment_status AS (
            SELECT id, payment_status
            FROM public.logistics_records
            WHERE id = ANY(p_record_ids)
        )
        SELECT 
            p.name,
            p.full_name,
            COUNT(DISTINCT lpc.logistics_record_id) as record_count,
            SUM(lpc.payable_amount) as total_amount
        FROM public.logistics_partner_costs lpc
        INNER JOIN record_max_levels rml ON lpc.logistics_record_id = rml.logistics_record_id
        INNER JOIN record_payment_status rps ON lpc.logistics_record_id = rps.id
        INNER JOIN public.partners p ON lpc.partner_id = p.id
        WHERE lpc.logistics_record_id = ANY(p_record_ids)
          AND rps.payment_status = 'Unpaid'  -- ✅ 只处理未支付运单
          AND (
              rml.cost_count = 1  -- ✅ 只有1个合作方，包含
              OR 
              lpc.level < rml.max_level  -- ✅ 多个合作方，只包含低层级
          )
          AND lpc.payment_status = 'Unpaid'
        GROUP BY p.id, p.name, p.full_name
        ORDER BY total_amount DESC
    LOOP
        v_notes_parts := array_append(
            v_notes_parts,
            format('%s申请付款共%s条运单金额¥%s',
                COALESCE(v_partner_info.full_name, v_partner_info.name),
                v_partner_info.record_count,
                ROUND(v_partner_info.total_amount, 2)
            )
        );
    END LOOP;
    
    -- 检查是否有需要付款的供应商
    IF array_length(v_notes_parts, 1) = 0 OR array_length(v_notes_parts, 1) IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '按规则排除最高级合作方后，没有需要申请付款的运单'
        );
    END IF;
    
    -- 创建1个付款申请单（包含所有运单）
    INSERT INTO public.payment_requests (
        request_id,
        logistics_record_ids,
        record_count,
        status,
        notes,
        created_by,
        user_id,
        created_at
    ) VALUES (
        v_request_number,
        p_record_ids,
        array_length(p_record_ids, 1),
        'Pending',
        array_to_string(v_notes_parts, '，'),  -- ✅ 用逗号分隔
        auth.uid(),
        auth.uid(),
        NOW()
    ) RETURNING id INTO v_request_id;
    
    -- 创建付款申请明细（关联所有运单）
    FOR v_rec_id IN SELECT unnest(p_record_ids)
    LOOP
        INSERT INTO public.payment_items (
            payment_request_id,
            logistics_record_id,
            user_id
        ) VALUES (
            v_request_id,
            v_rec_id,
            auth.uid()
        );
    END LOOP;
    
    -- 更新合作方成本状态（只更新低层级的，不更新最高级）
    FOR v_rec_id IN SELECT unnest(p_record_ids)
    LOOP
        <<inner_block>>
        DECLARE
            v_cost_count INTEGER;
            v_rec_payment_status TEXT;
        BEGIN
            -- ✅ 检查运单支付状态
            SELECT payment_status INTO v_rec_payment_status
            FROM public.logistics_records
            WHERE id = v_rec_id;
            
            -- 只处理未支付状态的运单
            IF v_rec_payment_status != 'Unpaid' THEN
                CONTINUE;
            END IF;
            
            -- 计算该运单的合作方数量和最高层级
            SELECT COUNT(*), MAX(level) 
            INTO v_cost_count, v_rec_max_level
            FROM public.logistics_partner_costs
            WHERE logistics_record_id = v_rec_id;
            
            -- ✅ 规则1：如果只有1个合作方，也要更新
            -- ✅ 规则2：如果有多个合作方，只更新低层级
            IF v_cost_count = 1 THEN
                -- 只有1个合作方，更新它
                UPDATE public.logistics_partner_costs
                SET 
                    payment_status = 'Processing',
                    payment_request_id = v_request_id,
                    payment_applied_at = NOW()
                WHERE logistics_record_id = v_rec_id
                  AND payment_status = 'Unpaid';
            ELSE
                -- 多个合作方，只更新低层级
                UPDATE public.logistics_partner_costs
                SET 
                    payment_status = 'Processing',
                    payment_request_id = v_request_id,
                    payment_applied_at = NOW()
                WHERE logistics_record_id = v_rec_id
                  AND level < v_rec_max_level
                  AND payment_status = 'Unpaid';
            END IF;
            
            GET DIAGNOSTICS v_temp_count = ROW_COUNT;
            v_updated_partner_costs := v_updated_partner_costs + v_temp_count;
        END inner_block;
    END LOOP;
    
    -- 更新运单状态为Processing
    UPDATE public.logistics_records
    SET payment_status = 'Processing'
    WHERE id = ANY(p_record_ids)
      AND payment_status = 'Unpaid';
    
    GET DIAGNOSTICS v_updated_records = ROW_COUNT;
    
    -- 返回结果
    RETURN json_build_object(
        'success', true,
        'message', format('成功创建1个付款申请单，包含%s条运单', array_length(p_record_ids, 1)),
        'request_id', v_request_id,
        'request_number', v_request_number,
        'record_count', array_length(p_record_ids, 1),
        'updated_partner_costs', v_updated_partner_costs,
        'updated_records', v_updated_records
    );
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '创建付款申请失败: %', SQLERRM;
END;
$function$;

COMMENT ON FUNCTION public.process_payment_application_1126 IS '创建付款申请（使用统一权限系统）';

-- ============================================================================
-- 5. void_and_delete_payment_requests_1126 - 批量作废并删除付款申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_and_delete_payment_requests_1126(p_request_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request_id TEXT;
    v_request record;
    v_logistics_record_ids UUID[];
    v_all_logistics_ids UUID[] := '{}';
    v_deleted_count INTEGER := 0;
    v_skipped_paid_count INTEGER := 0;
    v_partner_costs_count INTEGER := 0;
    v_logistics_records_count INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
    -- 检查功能权限：finance.void_payment
    IF NOT public.has_function_permission('finance.void_payment') THEN
        RAISE EXCEPTION '权限不足：您没有作废付款申请单的权限。请联系管理员在权限管理中分配 "finance.void_payment" 权限。';
    END IF;
    
    -- 遍历每个申请单
    FOREACH v_request_id IN ARRAY p_request_ids
    LOOP
        -- 获取申请单信息
        SELECT * INTO v_request
        FROM public.payment_requests
        WHERE request_id = v_request_id;
        
        IF NOT FOUND THEN
            CONTINUE;
        END IF;
        
        -- 检查状态，跳过已付款的
        IF v_request.status = 'Paid' THEN
            v_skipped_paid_count := v_skipped_paid_count + 1;
            CONTINUE;
        END IF;
        
        -- 获取关联的运单ID
        v_logistics_record_ids := v_request.logistics_record_ids;
        
        -- 收集所有运单ID
        IF v_logistics_record_ids IS NOT NULL THEN
            v_all_logistics_ids := v_all_logistics_ids || v_logistics_record_ids;
        END IF;
        
        -- 回滚 logistics_partner_costs 状态
        IF v_logistics_record_ids IS NOT NULL AND array_length(v_logistics_record_ids, 1) > 0 THEN
            UPDATE public.logistics_partner_costs
            SET 
                payment_status = 'Unpaid',
                payment_request_id = NULL,
                payment_applied_at = NULL
            WHERE logistics_record_id = ANY(v_logistics_record_ids);
            
            v_partner_costs_count := v_partner_costs_count + (
                SELECT COUNT(*) 
                FROM public.logistics_partner_costs 
                WHERE logistics_record_id = ANY(v_logistics_record_ids)
            );
        END IF;
        
        -- 删除付款申请明细（如果有）
        DELETE FROM public.payment_items
        WHERE payment_request_id IN (
            SELECT id FROM public.payment_requests WHERE request_id = v_request_id
        );
        
        -- 删除付款申请记录
        DELETE FROM public.payment_requests
        WHERE request_id = v_request_id;
        
        v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    -- 回滚所有相关运单的付款状态（清理所有付款相关字段）
    IF array_length(v_all_logistics_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            payment_status = 'Unpaid',
            payment_request_id = NULL,
            payment_applied_at = NULL,
            payment_completed_at = NULL,  -- ✅ 清理完成时间
            payment_reference = NULL  -- ✅ 清理付款参考号
        WHERE id = ANY(v_all_logistics_ids);
        
        GET DIAGNOSTICS v_logistics_records_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '付款申请单已删除，运单状态已回滚',
        'deleted_requests', v_deleted_count,
        'skipped_paid', v_skipped_paid_count,
        'affected_partner_costs', v_partner_costs_count,
        'affected_logistics_records', v_logistics_records_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '删除付款申请单失败: ' || SQLERRM
    );
END;
$function$;

COMMENT ON FUNCTION public.void_and_delete_payment_requests_1126 IS '批量作废并删除付款申请（使用统一权限系统）';

-- ============================================================================
-- 6. void_payment_for_request_1126 - 取消付款（保留申请单记录）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_payment_for_request_1126(p_request_id text, p_cancel_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request record;
    v_logistics_record_ids UUID[];
    v_waybill_count INTEGER := 0;
    v_partner_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_or_admin()）
    -- 检查功能权限：finance.void_payment
    IF NOT public.has_function_permission('finance.void_payment') THEN
        RAISE EXCEPTION '权限不足：您没有取消付款的权限。请联系管理员在权限管理中分配 "finance.void_payment" 权限。';
    END IF;

    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.payment_requests
    WHERE request_id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '付款申请单不存在: %', p_request_id;
    END IF;

    -- 检查状态
    IF v_request.status != 'Paid' THEN
        RAISE EXCEPTION '只有已付款的申请单可以取消付款，当前状态: %', v_request.status;
    END IF;

    -- 获取关联的运单ID
    v_logistics_record_ids := v_request.logistics_record_ids;

    -- 执行取消付款操作
    IF v_logistics_record_ids IS NOT NULL AND array_length(v_logistics_record_ids, 1) > 0 THEN
        SELECT (public.cancel_payment_status_for_waybills(v_logistics_record_ids)->>'updated_waybills')::INTEGER INTO v_waybill_count;
    END IF;

    -- 更新申请单状态
    UPDATE public.payment_requests
    SET 
        status = 'Approved',  -- 申请单状态回退到已审批
        updated_at = NOW(),
        notes = COALESCE(notes, '') || ' [付款已取消: ' || COALESCE(p_cancel_reason, '手动取消') || ']'
    WHERE request_id = p_request_id;

    -- 更新付款申请明细状态（如果存在）
    UPDATE public.partner_payment_items
    SET 
        payment_status = 'Unpaid',
        payment_completed_at = NULL,
        updated_at = NOW()
    WHERE payment_request_id = v_request.id
      AND payment_status = 'Paid';

    GET DIAGNOSTICS v_partner_count = ROW_COUNT;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '付款已取消，运单状态回退到未付款',
        'request_id', p_request_id,
        'waybill_count', v_waybill_count,
        'partner_item_count', v_partner_count,
        'cancel_reason', p_cancel_reason
    );

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.void_payment_for_request_1126 IS '取消付款（保留申请单记录，使用统一权限系统）';

-- ============================================================================
-- 7. batch_modify_chain_1126 - 批量修改合作链路
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_modify_chain_1126(p_record_ids uuid[], p_chain_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_records TEXT[] := '{}';
    v_total_partners INTEGER := 0;
BEGIN
    -- ✅ 使用统一权限系统检查权限（替代硬编码的 is_finance_operator_or_admin()）
    -- 检查功能权限：data.modify_chain
    IF NOT public.has_function_permission('data.modify_chain') THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：您没有批量修改合作链路的权限。请联系管理员在权限管理中分配 "data.modify_chain" 权限。'
        );
    END IF;
    
    -- 遍历每个运单
    FOREACH v_record_id IN ARRAY p_record_ids
    LOOP
        BEGIN
            DECLARE
                v_result JSON;
                v_auto_number TEXT;
            BEGIN
                -- 获取运单编号
                SELECT auto_number INTO v_auto_number
                FROM public.logistics_records
                WHERE id = v_record_id;
                
                -- 调用单个运单的链路修改函数（使用_1126版本）
                SELECT public.modify_logistics_record_chain_with_recalc_1126(
                    v_record_id,
                    p_chain_name
                ) INTO v_result;
                
                -- 检查结果
                IF (v_result->>'success')::boolean THEN
                    v_updated_count := v_updated_count + 1;
                    v_total_partners := v_total_partners + COALESCE((v_result->>'recalculated_partners')::integer, 0);
                ELSE
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(
                        v_failed_records, 
                        v_auto_number || '(' || (v_result->>'message') || ')'
                    );
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_records := array_append(v_failed_records, v_auto_number || '(系统错误)');
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'failed_count', v_failed_count,
        'total_partners', v_total_partners,
        'failed_records', v_failed_records,
        'message', format('成功更新 %s 条运单，重新计算 %s 个合作方成本，失败 %s 条', 
                         v_updated_count, v_total_partners, v_failed_count)
    );
END;
$function$;

COMMENT ON FUNCTION public.batch_modify_chain_1126 IS '批量修改合作链路（使用统一权限系统）';

COMMIT;

-- ============================================================================
-- 完成说明
-- ============================================================================
-- 已创建7个函数的_1126版本，所有硬编码权限检查已替换为统一权限系统：
-- 1. batch_rollback_invoice_approval_1126 - 使用 finance.rollback_invoice_approval
-- 2. void_and_delete_invoice_requests_1126 - 使用 finance.void_invoice
-- 3. void_invoice_request_1126 - 使用 finance.void_invoice
-- 4. process_payment_application_1126 - 使用 finance.create_payment_request
-- 5. void_and_delete_payment_requests_1126 - 使用 finance.void_payment
-- 6. void_payment_for_request_1126 - 使用 finance.void_payment
-- 7. batch_modify_chain_1126 - 使用 data.modify_chain
-- ============================================================================

