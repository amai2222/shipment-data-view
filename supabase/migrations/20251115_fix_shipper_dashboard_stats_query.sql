-- ============================================================================
-- 修复货主看板统计函数查询逻辑
-- 创建时间：2025-11-15
-- 问题：货主看板数据为0，可能是查询逻辑有问题
-- 解决：修复查询逻辑，确保正确统计货主数据
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_shipper_dashboard_stats_1115(
    p_shipper_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_include_self BOOLEAN DEFAULT TRUE,
    p_include_subordinates BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_shipper_path TEXT;
    v_result JSON;
    v_total_records BIGINT := 0;
    v_total_weight NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_self_records BIGINT := 0;
    v_self_weight NUMERIC := 0;
    v_self_amount NUMERIC := 0;
    v_subordinates_records BIGINT := 0;
    v_subordinates_weight NUMERIC := 0;
    v_subordinates_amount NUMERIC := 0;
    v_active_projects BIGINT := 0;
    v_active_drivers BIGINT := 0;
    v_pending_payments BIGINT := 0;
    v_pending_invoices BIGINT := 0;
    v_overdue_payments BIGINT := 0;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- 设置日期范围默认值
    v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, CURRENT_DATE);

    -- 获取货主的层级路径
    SELECT hierarchy_path INTO v_shipper_path
    FROM public.partners
    WHERE id = p_shipper_id AND partner_type = '货主';

    IF v_shipper_path IS NULL THEN
        RAISE EXCEPTION '货主不存在或不是货主类型';
    END IF;

    -- 统计本级货主的数据
    -- ✅ 修复：使用子查询避免重复统计，并确保正确关联项目
    IF p_include_self THEN
        SELECT 
            COUNT(DISTINCT lr.id),
            COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0),
            COALESCE(SUM(lr.payable_cost), 0)
        INTO v_self_records, v_self_weight, v_self_amount
        FROM (
            SELECT DISTINCT lr.id, lr.unloading_weight, lr.loading_weight, lr.payable_cost
            FROM public.logistics_records lr
            INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
            WHERE pp.partner_id = p_shipper_id
              AND lr.loading_date >= v_start_date
              AND lr.loading_date <= v_end_date
        ) lr;
    END IF;

    -- 统计所有下级货主的数据
    -- ✅ 修复：使用子查询避免重复统计
    IF p_include_subordinates THEN
        SELECT 
            COUNT(DISTINCT lr.id),
            COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0),
            COALESCE(SUM(lr.payable_cost), 0)
        INTO v_subordinates_records, v_subordinates_weight, v_subordinates_amount
        FROM (
            SELECT DISTINCT lr.id, lr.unloading_weight, lr.loading_weight, lr.payable_cost
            FROM public.logistics_records lr
            INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
            INNER JOIN public.partners p ON pp.partner_id = p.id
            WHERE p.hierarchy_path LIKE v_shipper_path || '/%'
              AND p.partner_type = '货主'
              AND lr.loading_date >= v_start_date
              AND lr.loading_date <= v_end_date
        ) lr;
    END IF;

    -- 计算总计
    v_total_records := v_self_records + v_subordinates_records;
    v_total_weight := v_self_weight + v_subordinates_weight;
    v_total_amount := v_self_amount + v_subordinates_amount;

    -- 统计活跃项目数（本级和下级）
    SELECT COUNT(DISTINCT pp.project_id)
    INTO v_active_projects
    FROM public.project_partners pp
    INNER JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主';

    -- 统计活跃司机数（本级和下级）
    SELECT COUNT(DISTINCT lr.driver_id)
    INTO v_active_drivers
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.loading_date >= v_start_date
      AND lr.loading_date <= v_end_date
      AND lr.driver_id IS NOT NULL;

    -- 统计待付款运单数（本级和下级）
    SELECT COUNT(DISTINCT lr.id)
    INTO v_pending_payments
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND (lr.payment_status = 'Unpaid' OR lr.payment_status = 'Processing');

    -- 统计待开票运单数（本级和下级）
    SELECT COUNT(DISTINCT lr.id)
    INTO v_pending_invoices
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND (lr.invoice_status = 'Uninvoiced' OR lr.invoice_status = 'Processing');

    -- 统计逾期付款（假设30天未付款为逾期）
    SELECT COUNT(DISTINCT lr.id)
    INTO v_overdue_payments
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND (lr.payment_status = 'Unpaid' OR lr.payment_status = 'Processing')
      AND lr.loading_date < CURRENT_DATE - INTERVAL '30 days';

    -- 构建JSON结果
    v_result := json_build_object(
        'summary', json_build_object(
            'totalRecords', v_total_records,
            'totalWeight', v_total_weight,
            'totalAmount', v_total_amount,
            'selfRecords', v_self_records,
            'selfWeight', v_self_weight,
            'selfAmount', v_self_amount,
            'subordinatesRecords', v_subordinates_records,
            'subordinatesWeight', v_subordinates_weight,
            'subordinatesAmount', v_subordinates_amount,
            'activeProjects', v_active_projects,
            'activeDrivers', v_active_drivers
        ),
        'pending', json_build_object(
            'pendingPayments', v_pending_payments,
            'pendingInvoices', v_pending_invoices,
            'overduePayments', v_overdue_payments
        ),
        'dateRange', json_build_object(
            'startDate', v_start_date,
            'endDate', v_end_date
        )
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_shipper_dashboard_stats_1115 IS '获取货主看板总体统计数据（包含本级和下级货主）- 已修复查询逻辑';

-- ============================================================================
-- 同时创建 get_subordinate_shippers_stats_1115 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subordinate_shippers_stats_1115(
    p_shipper_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    shipper_id UUID,
    shipper_name TEXT,
    hierarchy_depth INTEGER,
    parent_id UUID,
    parent_name TEXT,
    record_count BIGINT,
    total_weight NUMERIC,
    total_amount NUMERIC,
    active_projects BIGINT,
    pending_payments BIGINT,
    pending_invoices BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_shipper_path TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- 设置日期范围默认值
    v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, CURRENT_DATE);

    -- 获取货主的层级路径
    SELECT hierarchy_path INTO v_shipper_path
    FROM public.partners
    WHERE id = p_shipper_id AND partner_type = '货主';

    IF v_shipper_path IS NULL THEN
        RAISE EXCEPTION '货主不存在或不是货主类型';
    END IF;

    -- 返回本级和所有下级货主的统计数据
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.hierarchy_depth,
        p.parent_partner_id,
        parent.name,
        COALESCE(stats.record_count, 0)::BIGINT,
        COALESCE(stats.total_weight, 0),
        COALESCE(stats.total_amount, 0),
        COALESCE(stats.active_projects, 0)::BIGINT,
        COALESCE(stats.pending_payments, 0)::BIGINT,
        COALESCE(stats.pending_invoices, 0)::BIGINT
    FROM public.partners p
    LEFT JOIN public.partners parent ON p.parent_partner_id = parent.id
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(DISTINCT lr.id) as record_count,
            SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) as total_weight,
            SUM(lr.payable_cost) as total_amount,
            COUNT(DISTINCT pp.project_id) as active_projects,
            COUNT(DISTINCT lr.id) FILTER (WHERE lr.payment_status IN ('Unpaid', 'Processing')) as pending_payments,
            COUNT(DISTINCT lr.id) FILTER (WHERE lr.invoice_status IN ('Uninvoiced', 'Processing')) as pending_invoices
        FROM public.project_partners pp
        LEFT JOIN public.logistics_records lr ON pp.project_id = lr.project_id 
            AND lr.loading_date >= v_start_date
            AND lr.loading_date <= v_end_date
        WHERE pp.partner_id = p.id
    ) stats ON TRUE
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
    ORDER BY p.hierarchy_depth, p.name;
END;
$$;

COMMENT ON FUNCTION public.get_subordinate_shippers_stats_1115 IS '获取下级货主列表及统计数据（包含本级和下级）- 已修复查询逻辑';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复完成：货主看板统计函数查询逻辑';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '1. ✅ 使用 DISTINCT 避免重复统计运单';
    RAISE NOTICE '2. ✅ 修复日期范围查询（使用 >= 和 <=）';
    RAISE NOTICE '3. ✅ 修复待付款和待开票状态查询';
    RAISE NOTICE '4. ✅ 确保正确关联 project_partners 和 logistics_records';
    RAISE NOTICE '5. ✅ 函数名添加 _1115 后缀';
    RAISE NOTICE '';
    RAISE NOTICE '已创建的函数：';
    RAISE NOTICE '  - get_shipper_dashboard_stats_1115()';
    RAISE NOTICE '  - get_subordinate_shippers_stats_1115()';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

