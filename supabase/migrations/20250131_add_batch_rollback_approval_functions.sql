-- ============================================================
-- 创建批量取消审批函数
-- ============================================================
-- 功能说明：
-- 1. batch_rollback_payment_approval: 批量取消付款审批
-- 2. batch_rollback_invoice_approval: 批量取消开票审批
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 付款申请 - 批量取消审批
-- ============================================================
CREATE OR REPLACE FUNCTION public.batch_rollback_payment_approval(
    p_request_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id TEXT;
    v_rollback_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
    v_not_approved_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以批量取消审批';
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
                SELECT 1 FROM public.payment_requests 
                WHERE request_id = v_request_id AND status = 'Approved'
            ) THEN
                -- 回滚状态为待审批
                UPDATE public.payment_requests
                SET 
                    status = 'Pending',
                    updated_at = NOW(),
                    notes = COALESCE(notes, '') || ' [批量取消审批]'
                WHERE request_id = v_request_id AND status = 'Approved';
                
                v_rollback_count := v_rollback_count + 1;
            ELSE
                -- 统计不是已审批状态的申请单
                IF EXISTS (
                    SELECT 1 FROM public.payment_requests 
                    WHERE request_id = v_request_id
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
$$;

COMMENT ON FUNCTION public.batch_rollback_payment_approval IS '
批量取消付款审批函数
- 将已审批的付款申请批量回滚为待审批状态
- 只处理状态为 Approved 的申请单
- 返回成功/失败统计信息
';

-- ============================================================
-- 2. 开票申请 - 批量取消审批
-- ============================================================
CREATE OR REPLACE FUNCTION public.batch_rollback_invoice_approval(
    p_request_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id UUID;
    v_rollback_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_requests UUID[] := '{}';
    v_not_approved_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以批量取消审批';
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
$$;

COMMENT ON FUNCTION public.batch_rollback_invoice_approval IS '
批量取消开票审批函数
- 将已审批的开票申请批量回滚为待审核状态
- 只处理状态为 Approved 的申请单
- 返回成功/失败统计信息
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 批量取消审批函数已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增函数：';
    RAISE NOTICE '1. batch_rollback_payment_approval';
    RAISE NOTICE '   - 批量取消付款审批';
    RAISE NOTICE '   - 参数: p_request_ids TEXT[]';
    RAISE NOTICE '';
    RAISE NOTICE '2. batch_rollback_invoice_approval';
    RAISE NOTICE '   - 批量取消开票审批';
    RAISE NOTICE '   - 参数: p_request_ids UUID[]';
    RAISE NOTICE '';
    RAISE NOTICE '性能优化：';
    RAISE NOTICE '- 一次性批量处理，避免循环调用';
    RAISE NOTICE '- 完善的错误处理和统计信息';
    RAISE NOTICE '- 适合大批量操作场景';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

