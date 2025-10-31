-- ============================================================================
-- 文件: 20251031_complete_invoice_workflow_optimization.sql
-- 描述: 开票流程完整优化 - 参考付款流程
-- 创建时间: 2025-10-31
-- ============================================================================
-- 
-- 本迁移文件实现：
-- 1. 修复开票审批函数 - 同时更新运单状态
-- 2. 修复开票完成函数 - 使用Completed状态而非Invoiced
-- 3. 添加批量审批功能
-- 4. 添加批量开票功能
-- 5. 添加取消开票功能（回滚到已审批待开票）
-- 6. 添加批量取消审批功能
-- 
-- 状态流转：
-- 运单: Uninvoiced -> Processing -> Approved -> Invoiced
-- 申请单: Pending -> Approved -> Completed
-- 
-- ============================================================================

-- ============================================================================
-- 第一部分：修复开票审批函数（同时更新运单状态）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_invoice_request_v2(
    p_request_number TEXT
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
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以审批开票申请';
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
$$;

COMMENT ON FUNCTION public.approve_invoice_request_v2 IS '审批开票申请（v2版本，同时更新运单状态为Approved）';

-- ============================================================================
-- 第二部分：批量审批开票申请
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_approve_invoice_requests(
    p_request_numbers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_number TEXT;
    v_success_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_total_waybills INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以批量审批开票申请';
    END IF;

    -- 遍历每个申请单号
    FOREACH v_request_number IN ARRAY p_request_numbers
    LOOP
        BEGIN
            DECLARE
                v_result JSONB;
            BEGIN
                -- 调用单个审批函数
                v_result := public.approve_invoice_request_v2(v_request_number);
                
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
$$;

COMMENT ON FUNCTION public.batch_approve_invoice_requests IS '批量审批开票申请';

-- ============================================================================
-- 第三部分：修复开票完成函数（使用Completed状态，同时更新运单）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_invoice_request_v2(
    p_request_number TEXT,
    p_invoice_number TEXT DEFAULT NULL,
    p_invoice_date DATE DEFAULT NULL
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
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以完成开票';
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
        status = 'Completed',  -- ✅ 使用Completed而非Invoiced
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
$$;

COMMENT ON FUNCTION public.complete_invoice_request_v2 IS '完成开票（v2版本，使用Completed状态，同时更新运单状态）';

-- ============================================================================
-- 第四部分：批量开票功能
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_complete_invoice_requests(
    p_request_numbers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_number TEXT;
    v_success_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_total_waybills INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以批量开票';
    END IF;

    -- 遍历每个申请单号
    FOREACH v_request_number IN ARRAY p_request_numbers
    LOOP
        BEGIN
            DECLARE
                v_result JSONB;
            BEGIN
                -- 调用单个开票函数
                v_result := public.complete_invoice_request_v2(v_request_number);
                
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
$$;

COMMENT ON FUNCTION public.batch_complete_invoice_requests IS '批量完成开票';

-- ============================================================================
-- 第五部分：取消开票功能（Completed -> Approved）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_invoice_request(
    p_request_number TEXT
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
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以取消开票';
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
$$;

COMMENT ON FUNCTION public.cancel_invoice_request IS '取消开票（回滚到已审批待开票状态）';

-- ============================================================================
-- 第六部分：批量取消开票
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_cancel_invoice_requests(
    p_request_numbers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_number TEXT;
    v_success_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_total_waybills INTEGER := 0;
    v_failed_requests TEXT[] := '{}';
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以批量取消开票';
    END IF;

    -- 遍历每个申请单号
    FOREACH v_request_number IN ARRAY p_request_numbers
    LOOP
        BEGIN
            DECLARE
                v_result JSONB;
            BEGIN
                -- 调用单个取消开票函数
                v_result := public.cancel_invoice_request(v_request_number);
                
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
$$;

COMMENT ON FUNCTION public.batch_cancel_invoice_requests IS '批量取消开票';

-- ============================================================================
-- 第七部分：添加运单invoice_status的Approved状态支持
-- ============================================================================

-- 检查并更新约束，添加Approved状态
DO $$ 
BEGIN
    -- 删除旧约束
    ALTER TABLE public.logistics_records 
    DROP CONSTRAINT IF EXISTS ck_logistics_records_invoice_status;
    
    -- 添加新约束，包含Approved状态
    ALTER TABLE public.logistics_records 
    ADD CONSTRAINT ck_logistics_records_invoice_status 
    CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Approved', 'Invoiced'));
    
    RAISE NOTICE '✅ logistics_records.invoice_status 约束已更新，包含Approved状态';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ 更新约束失败（可能已存在）: %', SQLERRM;
END $$;

-- 为合作方成本表也添加Approved状态
DO $$ 
BEGIN
    -- 删除旧约束
    ALTER TABLE public.logistics_partner_costs 
    DROP CONSTRAINT IF EXISTS ck_logistics_partner_costs_invoice_status;
    
    -- 添加新约束，包含Approved状态
    ALTER TABLE public.logistics_partner_costs 
    ADD CONSTRAINT ck_logistics_partner_costs_invoice_status 
    CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Approved', 'Invoiced'));
    
    RAISE NOTICE '✅ logistics_partner_costs.invoice_status 约束已更新，包含Approved状态';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ 更新约束失败（可能已存在）: %', SQLERRM;
END $$;

-- ============================================================================
-- 第八部分：修复现有complete_invoice_request函数使用Completed状态
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_invoice_request(
    p_request_id uuid,
    p_invoice_number text DEFAULT NULL,
    p_invoice_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    v_record_ids UUID[];
    v_updated_count INTEGER := 0;
    result_json json;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以完成开票';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Approved' THEN
        RAISE EXCEPTION '只能完成已批准的开票申请，当前状态: %', v_request.status;
    END IF;

    -- 获取关联的运单ID
    SELECT ARRAY_AGG(DISTINCT logistics_record_id)
    INTO v_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;

    -- 更新申请状态和发票信息（使用Completed而非Invoiced）
    UPDATE invoice_requests 
    SET 
        status = 'Completed',  -- ✅ 修改为Completed
        invoice_number = COALESCE(p_invoice_number, invoice_number),
        invoice_date = COALESCE(p_invoice_date, invoice_date, CURRENT_DATE),
        updated_at = NOW()
    WHERE id = p_request_id;

    -- 更新运单开票状态
    IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            invoice_status = 'Invoiced',
            invoice_completed_at = NOW()
        WHERE id = ANY(v_record_ids);
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 更新相关合作方成本记录状态为已开票
    UPDATE logistics_partner_costs 
    SET 
        invoice_status = 'Invoiced',
        invoice_number = COALESCE(p_invoice_number, invoice_number),
        invoice_completed_at = NOW()
    WHERE invoice_request_id = p_request_id;

    result_json := json_build_object(
        'success', true,
        'message', format('开票完成，%s条运单状态已更新', v_updated_count),
        'request_id', p_request_id,
        'invoice_number', COALESCE(p_invoice_number, v_request.invoice_number),
        'invoice_date', COALESCE(p_invoice_date, v_request.invoice_date, CURRENT_DATE),
        'updated_count', v_updated_count
    );

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.complete_invoice_request IS '完成开票（修复版，使用Completed状态）';

-- ============================================================================
-- 第九部分：批量取消审批功能（Approved -> Pending，运单Approved -> Processing）
-- ============================================================================

-- 注意：batch_rollback_invoice_approval 已在 20250131_add_batch_rollback_approval_functions.sql 中创建
-- 这里只需确保该函数存在即可

-- 检查函数是否存在
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'batch_rollback_invoice_approval'
    ) THEN
        RAISE NOTICE '⚠️ batch_rollback_invoice_approval 函数不存在，需要执行 20250131_add_batch_rollback_approval_functions.sql';
    ELSE
        RAISE NOTICE '✅ batch_rollback_invoice_approval 函数已存在';
    END IF;
END $$;

-- ============================================================================
-- 测试和验证
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '开票流程优化迁移完成';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增/更新的函数：';
    RAISE NOTICE '  1. approve_invoice_request_v2 - 审批开票申请（同时更新运单状态）';
    RAISE NOTICE '  2. batch_approve_invoice_requests - 批量审批';
    RAISE NOTICE '  3. complete_invoice_request_v2 - 完成开票（使用Completed状态）';
    RAISE NOTICE '  4. complete_invoice_request - 修复为使用Completed状态';
    RAISE NOTICE '  5. batch_complete_invoice_requests - 批量开票';
    RAISE NOTICE '  6. cancel_invoice_request - 取消开票';
    RAISE NOTICE '  7. batch_cancel_invoice_requests - 批量取消开票';
    RAISE NOTICE '';
    RAISE NOTICE '状态流转：';
    RAISE NOTICE '  运单: Uninvoiced -> Processing -> Approved -> Invoiced';
    RAISE NOTICE '  申请单: Pending -> Approved -> Completed';
    RAISE NOTICE '';
    RAISE NOTICE '新增状态：';
    RAISE NOTICE '  - logistics_records.invoice_status 新增 Approved（开票审核通过）';
    RAISE NOTICE '  - logistics_partner_costs.invoice_status 新增 Approved';
    RAISE NOTICE '';
    RAISE NOTICE '操作对应：';
    RAISE NOTICE '  - 审批：申请单 Pending->Approved，运单 Processing->Approved';
    RAISE NOTICE '  - 开票：申请单 Approved->Completed，运单 Approved->Invoiced';
    RAISE NOTICE '  - 取消审批：申请单 Approved->Pending，运单 Approved->Processing';
    RAISE NOTICE '  - 取消开票：申请单 Completed->Approved，运单 Invoiced->Approved';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 开票流程已与付款流程完全对齐！';
    RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- 授权
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.approve_invoice_request_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_approve_invoice_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_invoice_request_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_complete_invoice_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_cancel_invoice_requests TO authenticated;

-- ============================================================================
-- 完成
-- ============================================================================

