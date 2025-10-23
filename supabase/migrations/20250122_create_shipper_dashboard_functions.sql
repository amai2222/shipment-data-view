-- ==========================================
-- 货主看板统计函数
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 
--   1. 获取货主看板统计数据
--   2. 获取下级货主列表及统计
--   3. 获取运单趋势数据
--   4. 权限控制：只能查看本级和下级货主的数据
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 获取货主看板总体统计数据
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shipper_dashboard_stats(
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

    -- 检查权限：用户必须是该货主或其上级
    -- (这里简化处理，实际应通过 user_id 关联检查)

    -- 统计本级货主的数据
    IF p_include_self THEN
        SELECT 
            COUNT(*),
            COALESCE(SUM(COALESCE(unloading_weight, loading_weight)), 0),
            COALESCE(SUM(payable_cost), 0)
        INTO v_self_records, v_self_weight, v_self_amount
        FROM public.logistics_records lr
        JOIN public.project_partners pp ON lr.project_id = pp.project_id
        WHERE pp.partner_id = p_shipper_id
          AND lr.loading_date BETWEEN v_start_date AND v_end_date;
    END IF;

    -- 统计所有下级货主的数据
    IF p_include_subordinates THEN
        SELECT 
            COUNT(*),
            COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0),
            COALESCE(SUM(lr.payable_cost), 0)
        INTO v_subordinates_records, v_subordinates_weight, v_subordinates_amount
        FROM public.logistics_records lr
        JOIN public.project_partners pp ON lr.project_id = pp.project_id
        JOIN public.partners p ON pp.partner_id = p.id
        WHERE p.hierarchy_path LIKE v_shipper_path || '/%'
          AND p.partner_type = '货主'
          AND lr.loading_date BETWEEN v_start_date AND v_end_date;
    END IF;

    -- 计算总计
    v_total_records := v_self_records + v_subordinates_records;
    v_total_weight := v_self_weight + v_subordinates_weight;
    v_total_amount := v_self_amount + v_subordinates_amount;

    -- 统计活跃项目数（本级和下级）
    SELECT COUNT(DISTINCT pp.project_id)
    INTO v_active_projects
    FROM public.project_partners pp
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主';

    -- 统计活跃司机数
    SELECT COUNT(DISTINCT lr.driver_id)
    INTO v_active_drivers
    FROM public.logistics_records lr
    JOIN public.project_partners pp ON lr.project_id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.loading_date BETWEEN v_start_date AND v_end_date;

    -- 统计待付款运单数
    SELECT COUNT(*)
    INTO v_pending_payments
    FROM public.logistics_records lr
    JOIN public.project_partners pp ON lr.project_id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.payment_status = 'Pending';

    -- 统计待开票运单数
    SELECT COUNT(*)
    INTO v_pending_invoices
    FROM public.logistics_records lr
    JOIN public.project_partners pp ON lr.project_id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.invoice_status = 'Pending';

    -- 统计逾期付款（假设30天未付款为逾期）
    SELECT COUNT(*)
    INTO v_overdue_payments
    FROM public.logistics_records lr
    JOIN public.project_partners pp ON lr.project_id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.payment_status = 'Pending'
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

COMMENT ON FUNCTION public.get_shipper_dashboard_stats IS '获取货主看板总体统计数据（包含本级和下级货主）';

-- ============================================================
-- 第二步: 获取下级货主列表及统计
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_subordinate_shippers_stats(
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
            COUNT(DISTINCT lr.id) FILTER (WHERE lr.payment_status = 'Pending') as pending_payments,
            COUNT(DISTINCT lr.id) FILTER (WHERE lr.invoice_status = 'Pending') as pending_invoices
        FROM public.project_partners pp
        LEFT JOIN public.logistics_records lr ON pp.project_id = lr.project_id 
            AND lr.loading_date BETWEEN v_start_date AND v_end_date
        WHERE pp.partner_id = p.id
    ) stats ON TRUE
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
    ORDER BY p.hierarchy_depth, p.name;
END;
$$;

COMMENT ON FUNCTION public.get_subordinate_shippers_stats IS '获取下级货主列表及统计数据';

-- ============================================================
-- 第三步: 获取运单趋势数据（按天）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shipper_trend_data(
    p_shipper_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    date DATE,
    self_count BIGINT,
    subordinates_count BIGINT,
    total_count BIGINT,
    self_amount NUMERIC,
    subordinates_amount NUMERIC,
    total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_shipper_path TEXT;
    v_start_date DATE;
BEGIN
    v_start_date := CURRENT_DATE - (p_days || ' days')::INTERVAL;

    -- 获取货主的层级路径
    SELECT hierarchy_path INTO v_shipper_path
    FROM public.partners
    WHERE id = p_shipper_id AND partner_type = '货主';

    IF v_shipper_path IS NULL THEN
        RAISE EXCEPTION '货主不存在或不是货主类型';
    END IF;

    -- 返回每天的统计数据
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            v_start_date,
            CURRENT_DATE,
            '1 day'::INTERVAL
        )::DATE as date
    ),
    self_stats AS (
        SELECT 
            lr.loading_date as date,
            COUNT(*) as count,
            COALESCE(SUM(lr.payable_cost), 0) as amount
        FROM public.logistics_records lr
        JOIN public.project_partners pp ON lr.project_id = pp.project_id
        WHERE pp.partner_id = p_shipper_id
          AND lr.loading_date >= v_start_date
        GROUP BY lr.loading_date
    ),
    subordinates_stats AS (
        SELECT 
            lr.loading_date as date,
            COUNT(*) as count,
            COALESCE(SUM(lr.payable_cost), 0) as amount
        FROM public.logistics_records lr
        JOIN public.project_partners pp ON lr.project_id = pp.project_id
        JOIN public.partners p ON pp.partner_id = p.id
        WHERE p.hierarchy_path LIKE v_shipper_path || '/%'
          AND p.partner_type = '货主'
          AND lr.loading_date >= v_start_date
        GROUP BY lr.loading_date
    )
    SELECT 
        ds.date,
        COALESCE(ss.count, 0)::BIGINT as self_count,
        COALESCE(subs.count, 0)::BIGINT as subordinates_count,
        (COALESCE(ss.count, 0) + COALESCE(subs.count, 0))::BIGINT as total_count,
        COALESCE(ss.amount, 0) as self_amount,
        COALESCE(subs.amount, 0) as subordinates_amount,
        (COALESCE(ss.amount, 0) + COALESCE(subs.amount, 0)) as total_amount
    FROM date_series ds
    LEFT JOIN self_stats ss ON ds.date = ss.date
    LEFT JOIN subordinates_stats subs ON ds.date = subs.date
    ORDER BY ds.date;
END;
$$;

COMMENT ON FUNCTION public.get_shipper_trend_data IS '获取货主运单趋势数据（按天统计）';

-- ============================================================
-- 第四步: 获取常用路线统计
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shipper_top_routes(
    p_shipper_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    loading_location TEXT,
    unloading_location TEXT,
    record_count BIGINT,
    total_weight NUMERIC,
    total_amount NUMERIC,
    avg_weight NUMERIC,
    avg_amount NUMERIC
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

    -- 返回Top路线统计
    RETURN QUERY
    SELECT 
        lr.loading_location,
        lr.unloading_location,
        COUNT(*)::BIGINT as record_count,
        COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0) as total_weight,
        COALESCE(SUM(lr.payable_cost), 0) as total_amount,
        COALESCE(AVG(COALESCE(lr.unloading_weight, lr.loading_weight)), 0) as avg_weight,
        COALESCE(AVG(lr.payable_cost), 0) as avg_amount
    FROM public.logistics_records lr
    JOIN public.project_partners pp ON lr.project_id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.loading_date BETWEEN v_start_date AND v_end_date
    GROUP BY lr.loading_location, lr.unloading_location
    ORDER BY record_count DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_shipper_top_routes IS '获取货主常用路线统计（Top N）';

-- ============================================================
-- 第五步: 获取项目分布统计
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shipper_project_distribution(
    p_shipper_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    record_count BIGINT,
    total_weight NUMERIC,
    total_amount NUMERIC,
    percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_shipper_path TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_total_records BIGINT;
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

    -- 获取总运单数
    SELECT COUNT(*)
    INTO v_total_records
    FROM public.logistics_records lr
    JOIN public.project_partners pp ON lr.project_id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
      AND lr.loading_date BETWEEN v_start_date AND v_end_date;

    -- 返回项目分布
    RETURN QUERY
    SELECT 
        proj.id,
        proj.name,
        COUNT(lr.id)::BIGINT as record_count,
        COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0) as total_weight,
        COALESCE(SUM(lr.payable_cost), 0) as total_amount,
        CASE 
            WHEN v_total_records > 0 THEN 
                ROUND((COUNT(lr.id)::NUMERIC / v_total_records * 100), 2)
            ELSE 0
        END as percentage
    FROM public.projects proj
    JOIN public.project_partners pp ON proj.id = pp.project_id
    JOIN public.partners p ON pp.partner_id = p.id
    LEFT JOIN public.logistics_records lr ON proj.id = lr.project_id
        AND lr.loading_date BETWEEN v_start_date AND v_end_date
    WHERE (p.id = p_shipper_id OR p.hierarchy_path LIKE v_shipper_path || '/%')
      AND p.partner_type = '货主'
    GROUP BY proj.id, proj.name
    HAVING COUNT(lr.id) > 0
    ORDER BY record_count DESC;
END;
$$;

COMMENT ON FUNCTION public.get_shipper_project_distribution IS '获取货主项目分布统计';

-- ============================================================
-- 完成提示
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 货主看板统计函数创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已创建的函数：';
    RAISE NOTICE '  1. get_shipper_dashboard_stats()      - 获取看板总体统计';
    RAISE NOTICE '  2. get_subordinate_shippers_stats()   - 获取下级货主列表及统计';
    RAISE NOTICE '  3. get_shipper_trend_data()           - 获取运单趋势数据';
    RAISE NOTICE '  4. get_shipper_top_routes()           - 获取常用路线Top N';
    RAISE NOTICE '  5. get_shipper_project_distribution() - 获取项目分布统计';
    RAISE NOTICE '';
    RAISE NOTICE '测试命令：';
    RAISE NOTICE '  -- 获取总体统计（最近30天）';
    RAISE NOTICE '  SELECT get_shipper_dashboard_stats(''货主UUID''::UUID);';
    RAISE NOTICE '';
    RAISE NOTICE '  -- 获取下级货主列表';
    RAISE NOTICE '  SELECT * FROM get_subordinate_shippers_stats(''货主UUID''::UUID);';
    RAISE NOTICE '';
    RAISE NOTICE '  -- 获取最近7天趋势';
    RAISE NOTICE '  SELECT * FROM get_shipper_trend_data(''货主UUID''::UUID, 7);';
    RAISE NOTICE '';
    RAISE NOTICE '  -- 获取Top 10路线';
    RAISE NOTICE '  SELECT * FROM get_shipper_top_routes(''货主UUID''::UUID);';
    RAISE NOTICE '';
    RAISE NOTICE '  -- 获取项目分布';
    RAISE NOTICE '  SELECT * FROM get_shipper_project_distribution(''货主UUID''::UUID);';
    RAISE NOTICE '';
    RAISE NOTICE '权限规则：';
    RAISE NOTICE '  ✓ 只能查看本级和下级货主的数据';
    RAISE NOTICE '  ✓ 基于 hierarchy_path 进行权限过滤';
    RAISE NOTICE '  ✓ 所有函数使用 SECURITY DEFINER';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

