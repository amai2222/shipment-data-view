-- ==========================================
-- 付款状态更新函数
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 更新运单付款状态并同步到 logistics_partner_costs 表
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 创建更新付款状态的函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_payment_status_for_waybills(
    p_record_ids UUID[],
    p_payment_status TEXT DEFAULT 'Paid',
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_partner_updated_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务或管理员可以更新付款状态';
    END IF;

    -- 记录操作日志
    RAISE NOTICE '开始更新付款状态: 运单数量=%', array_length(p_record_ids, 1);

    -- 更新 logistics_records 表的付款状态
    UPDATE public.logistics_records
    SET 
        payment_status = p_payment_status,
        payment_completed_at = CASE 
            WHEN p_payment_status = 'Paid' THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = ANY(p_record_ids)
      AND payment_status != p_payment_status;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条运单的付款状态', v_updated_count;

    -- 更新 logistics_partner_costs 表中对应运单的合作方（货主除外）的付款状态
    UPDATE public.logistics_partner_costs lpc
    SET 
        payment_status = p_payment_status,
        payment_completed_at = CASE 
            WHEN p_payment_status = 'Paid' THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW()
    FROM public.logistics_records lr
    JOIN public.partners p ON lpc.partner_id = p.id
    WHERE lpc.logistics_record_id = lr.id
      AND lr.id = ANY(p_record_ids)
      AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外，处理NULL值
      AND lpc.payment_status != p_payment_status;

    GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条合作方成本记录的付款状态', v_partner_updated_count;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '付款状态更新成功',
        'updated_waybills', v_updated_count,
        'updated_partner_costs', v_partner_updated_count,
        'record_ids', p_record_ids
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.set_payment_status_for_waybills IS '更新运单付款状态并同步到合作方成本表（货主除外）（重命名避免冲突）';

-- ============================================================
-- 第二步: 创建生成付款申请单PDF的函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_payment_request_pdf_data(
    p_record_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
    v_waybill_data JSONB;
    v_partner_totals JSONB;
BEGIN
    -- 获取运单数据
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', lr.id,
            'auto_number', lr.auto_number,
            'project_name', lr.project_name,
            'driver_name', lr.driver_name,
            'loading_location', lr.loading_location,
            'unloading_location', lr.unloading_location,
            'loading_date', to_char(lr.loading_date, 'YYYY-MM-DD'),
            'loading_weight', lr.loading_weight,
            'current_cost', lr.current_cost,
            'extra_cost', lr.extra_cost,
            'payable_cost', lr.payable_cost,
            'license_plate', lr.license_plate,
            'driver_phone', lr.driver_phone,
            'transport_type', lr.transport_type,
            'remarks', lr.remarks
        )
    ) INTO v_waybill_data
    FROM public.logistics_records lr
    WHERE lr.id = ANY(p_record_ids);

    -- 获取合作方汇总数据（修复聚合函数嵌套问题）
    WITH partner_totals AS (
        SELECT 
            lpc.partner_id,
            p.name as partner_name,
            lpc.level,
            SUM(lpc.payable_amount) as total_amount
        FROM public.logistics_partner_costs lpc
        JOIN public.partners p ON lpc.partner_id = p.id
        WHERE lpc.logistics_record_id = ANY(p_record_ids)
          AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外，处理NULL值
        GROUP BY lpc.partner_id, p.name, lpc.level
        ORDER BY lpc.level
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'partner_id', partner_id,
            'partner_name', partner_name,
            'level', level,
            'total_amount', total_amount
        )
    ) INTO v_partner_totals
    FROM partner_totals;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'waybills', COALESCE(v_waybill_data, '[]'::jsonb),
        'partner_totals', COALESCE(v_partner_totals, '[]'::jsonb),
        'total_waybills', array_length(p_record_ids, 1),
        'generated_at', NOW()
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_payment_request_pdf_data IS '获取付款申请单PDF所需的数据（重命名避免冲突）';

COMMIT;
