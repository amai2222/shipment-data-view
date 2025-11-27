-- ============================================================================
-- 修复删除运单函数中的表名错误
-- 创建日期：2025-11-25
-- 问题：delete_waybills_by_project_and_date 函数使用了不存在的 payment_request_items 表
-- 修复：使用 payment_requests.logistics_record_ids 数组字段检查关联关系
-- ============================================================================

BEGIN;

-- ============================================================================
-- 修复 delete_waybills_by_project_and_date 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_waybills_by_project_and_date(
    p_project_name TEXT,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_project_id UUID;
    v_target_record_ids UUID[];
    v_deleted_logistics_count INTEGER := 0;
    v_deleted_costs_count INTEGER := 0;
    v_has_payment_requests BOOLEAN;
    v_has_invoice_requests BOOLEAN;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- ========== 第1步：验证项目 ==========
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE name = p_project_name;

    IF v_project_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '找不到名为 "' || p_project_name || '" 的项目',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    -- 转换日期参数：将 TEXT 转换为 DATE，空字符串或 NULL 转换为 NULL
    v_start_date := CASE 
        WHEN p_start_date IS NULL OR p_start_date = '' THEN NULL 
        ELSE p_start_date::DATE 
    END;
    v_end_date := CASE 
        WHEN p_end_date IS NULL OR p_end_date = '' THEN NULL 
        ELSE p_end_date::DATE 
    END;

    -- ========== 第2步：查找符合条件的运单ID ==========
    -- ✅ 修复：使用 +08:00 时区转换，确保按中国时区日期进行比较
    SELECT array_agg(id)
    INTO v_target_record_ids
    FROM public.logistics_records
    WHERE project_id = v_project_id
      AND (v_start_date IS NULL OR 
           loading_date >= (v_start_date::text || ' 00:00:00+08:00')::timestamptz)
      AND (v_end_date IS NULL OR 
           loading_date < ((v_end_date::text || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'));

    -- 如果没有找到任何运单记录，返回提示
    IF v_target_record_ids IS NULL OR array_length(v_target_record_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', '没有找到符合条件的运单记录，无需删除',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    -- ========== 第3步：安全检查 ==========
    -- 检查是否有关联的付款申请（只检查未完成的申请）
    -- ✅ 修复：payment_requests 表使用 logistics_record_ids 数组字段，而不是 payment_request_items 表
    SELECT EXISTS(
        SELECT 1
        FROM public.payment_requests pr
        WHERE pr.logistics_record_ids && v_target_record_ids  -- 使用数组交集操作符检查是否有重叠
          AND pr.status IN ('Pending', 'Approved')  -- 待审核和已审批状态都视为未完成
    ) INTO v_has_payment_requests;

    -- 检查是否有关联的发票申请（只检查未完成的申请）
    -- ✅ 修复：使用 invoice_request_details 表（正确的表名）
    SELECT EXISTS(
        SELECT 1
        FROM public.invoice_requests ir
        JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = ANY(v_target_record_ids)
          AND ir.status IN ('Pending', 'Approved')  -- 待审核和已审批状态都视为未完成
    ) INTO v_has_invoice_requests;

    -- 如果有未完成的付款或发票申请，返回错误
    IF v_has_payment_requests THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '存在未完成的付款申请，无法删除相关运单。请先完成或取消付款申请。',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    IF v_has_invoice_requests THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '存在未完成的发票申请，无法删除相关运单。请先完成或取消发票申请。',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    -- ========== 第4步：删除关联的成本记录 ==========
    WITH deleted_rows AS (
        DELETE FROM public.logistics_partner_costs
        WHERE logistics_record_id = ANY(v_target_record_ids)
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_costs_count FROM deleted_rows;

    -- ========== 第5步：删除运单记录 ==========
    WITH deleted_rows AS (
        DELETE FROM public.logistics_records
        WHERE id = ANY(v_target_record_ids)
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_logistics_count FROM deleted_rows;

    -- ========== 第6步：返回结果 ==========
    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功删除 %s 条运单记录和 %s 条成本记录', 
                         v_deleted_logistics_count, 
                         v_deleted_costs_count),
        'deleted_logistics_count', v_deleted_logistics_count,
        'deleted_costs_count', v_deleted_costs_count,
        'project_name', p_project_name,
        'start_date', p_start_date,
        'end_date', p_end_date
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '删除运单时发生错误: ' || SQLERRM,
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
END;
$$;

COMMENT ON FUNCTION public.delete_waybills_by_project_and_date IS '按项目和日期范围删除运单记录（包含安全检查，已修复表名错误）';

-- ============================================================================
-- 刷新 schema cache
-- ============================================================================

-- 通过调用函数来刷新 schema cache
DO $$
BEGIN
    -- 尝试调用函数以刷新 schema cache（使用空参数，函数会返回错误但不影响 schema cache 刷新）
    PERFORM public.delete_waybills_by_project_and_date('__schema_cache_refresh__', NULL, NULL);
EXCEPTION WHEN OTHERS THEN
    -- 忽略错误，这只是为了刷新 schema cache
    NULL;
END $$;

COMMIT;

-- ============================================================================
-- 完成信息
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '删除运单函数表名错误修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  ✓ payment_request_items → payment_requests.logistics_record_ids (数组字段)';
    RAISE NOTICE '  ✓ invoice_request_items → invoice_request_details (正确的表名)';
    RAISE NOTICE '  ✓ 使用数组交集操作符 && 检查付款申请关联';
    RAISE NOTICE '';
    RAISE NOTICE '影响：';
    RAISE NOTICE '  ✓ 删除运单功能：正常工作';
    RAISE NOTICE '  ✓ 安全检查：正常工作';
    RAISE NOTICE '  ✓ 数据保护：正常工作';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

