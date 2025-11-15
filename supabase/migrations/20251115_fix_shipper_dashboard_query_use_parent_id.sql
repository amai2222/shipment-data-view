-- ============================================================================
-- 修复货主看板查询逻辑：使用 parent_partner_id 而不是 hierarchy_path
-- 创建时间：2025-11-15
-- 问题：hierarchy_path 可能没有正确维护，应该使用 parent_partner_id 查询下级
-- 解决：修改查询逻辑，使用递归查询或 parent_partner_id 来查找所有下级
-- ============================================================================

BEGIN;

-- ============================================================================
-- 修复 get_shipper_dashboard_stats_1115 函数
-- 使用递归查询查找所有下级货主
-- ============================================================================

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
    v_all_shipper_ids UUID[];  -- 包含本级和所有下级的ID数组
BEGIN
    -- 设置日期范围默认值
    v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, CURRENT_DATE);

    -- 验证货主是否存在
    IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主') THEN
        RAISE EXCEPTION '货主不存在或不是货主类型';
    END IF;

    -- ✅ 关键修复：使用递归查询获取所有下级货主ID（包括本级）
    WITH RECURSIVE shipper_hierarchy AS (
        -- 起点：当前货主
        SELECT id, parent_partner_id, 0 as level
        FROM public.partners
        WHERE id = p_shipper_id AND partner_type = '货主'
        
        UNION ALL
        
        -- 递归：查找所有下级
        SELECT p.id, p.parent_partner_id, sh.level + 1
        FROM public.partners p
        INNER JOIN shipper_hierarchy sh ON p.parent_partner_id = sh.id
        WHERE p.partner_type = '货主'
          AND sh.level < 100  -- 防止无限循环
    )
    SELECT ARRAY_AGG(id) INTO v_all_shipper_ids
    FROM shipper_hierarchy;

    -- 如果查询失败或为空，初始化为只包含当前货主
    IF v_all_shipper_ids IS NULL THEN
        v_all_shipper_ids := ARRAY[p_shipper_id];
    END IF;

    -- 统计本级货主的数据
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
            WHERE pp.partner_id = p_shipper_id  -- ✅ 直接匹配当前货主ID
              AND lr.loading_date::date >= v_start_date
              AND lr.loading_date::date <= v_end_date
        ) lr;
    END IF;

    -- 统计所有下级货主的数据
    -- ✅ 关键修复：使用 parent_partner_id 递归查询，而不是 hierarchy_path
    IF p_include_subordinates THEN
        -- 获取所有下级货主ID（排除本级）
        WITH RECURSIVE subordinate_shippers AS (
            -- 起点：直接下级
            SELECT id
            FROM public.partners
            WHERE parent_partner_id = p_shipper_id AND partner_type = '货主'
            
            UNION ALL
            
            -- 递归：查找所有间接下级
            SELECT p.id
            FROM public.partners p
            INNER JOIN subordinate_shippers ss ON p.parent_partner_id = ss.id
            WHERE p.partner_type = '货主'
        )
        SELECT 
            COUNT(DISTINCT lr.id),
            COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0),
            COALESCE(SUM(lr.payable_cost), 0)
        INTO v_subordinates_records, v_subordinates_weight, v_subordinates_amount
        FROM (
            SELECT DISTINCT lr.id, lr.unloading_weight, lr.loading_weight, lr.payable_cost
            FROM public.logistics_records lr
            INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
            INNER JOIN subordinate_shippers ss ON pp.partner_id = ss.id
            WHERE lr.loading_date::date >= v_start_date
              AND lr.loading_date::date <= v_end_date
        ) lr;
    END IF;

    -- 计算总计
    v_total_records := v_self_records + v_subordinates_records;
    v_total_weight := v_self_weight + v_subordinates_weight;
    v_total_amount := v_self_amount + v_subordinates_amount;

    -- 统计活跃项目数（本级和下级）
    WITH RECURSIVE all_shippers AS (
        SELECT id FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主'
        UNION ALL
        SELECT p.id
        FROM public.partners p
        INNER JOIN all_shippers a ON p.parent_partner_id = a.id
        WHERE p.partner_type = '货主'
    )
    SELECT COUNT(DISTINCT pp.project_id)
    INTO v_active_projects
    FROM public.project_partners pp
    INNER JOIN all_shippers a ON pp.partner_id = a.id;

    -- 统计活跃司机数（本级和下级）
    WITH RECURSIVE all_shippers AS (
        SELECT id FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主'
        UNION ALL
        SELECT p.id
        FROM public.partners p
        INNER JOIN all_shippers a ON p.parent_partner_id = a.id
        WHERE p.partner_type = '货主'
    )
    SELECT COUNT(DISTINCT lr.driver_id)
    INTO v_active_drivers
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN all_shippers a ON pp.partner_id = a.id
    WHERE lr.loading_date::date >= v_start_date
      AND lr.loading_date::date <= v_end_date
      AND lr.driver_id IS NOT NULL;

    -- 统计待付款运单数（本级和下级）
    WITH RECURSIVE all_shippers AS (
        SELECT id FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主'
        UNION ALL
        SELECT p.id
        FROM public.partners p
        INNER JOIN all_shippers a ON p.parent_partner_id = a.id
        WHERE p.partner_type = '货主'
    )
    SELECT COUNT(DISTINCT lr.id)
    INTO v_pending_payments
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN all_shippers a ON pp.partner_id = a.id
    WHERE (lr.payment_status = 'Unpaid' OR lr.payment_status = 'Processing');

    -- 统计待开票运单数（本级和下级）
    WITH RECURSIVE all_shippers AS (
        SELECT id FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主'
        UNION ALL
        SELECT p.id
        FROM public.partners p
        INNER JOIN all_shippers a ON p.parent_partner_id = a.id
        WHERE p.partner_type = '货主'
    )
    SELECT COUNT(DISTINCT lr.id)
    INTO v_pending_invoices
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN all_shippers a ON pp.partner_id = a.id
    WHERE (lr.invoice_status = 'Uninvoiced' OR lr.invoice_status = 'Processing');

    -- 统计逾期付款（假设30天未付款为逾期）
    WITH RECURSIVE all_shippers AS (
        SELECT id FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主'
        UNION ALL
        SELECT p.id
        FROM public.partners p
        INNER JOIN all_shippers a ON p.parent_partner_id = a.id
        WHERE p.partner_type = '货主'
    )
    SELECT COUNT(DISTINCT lr.id)
    INTO v_overdue_payments
    FROM public.logistics_records lr
    INNER JOIN public.project_partners pp ON lr.project_id = pp.project_id
    INNER JOIN all_shippers a ON pp.partner_id = a.id
    WHERE (lr.payment_status = 'Unpaid' OR lr.payment_status = 'Processing')
      AND lr.loading_date::date < CURRENT_DATE - INTERVAL '30 days';

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

COMMENT ON FUNCTION public.get_shipper_dashboard_stats_1115 IS '获取货主看板总体统计数据（包含本级和下级货主）- 使用 parent_partner_id 递归查询';

-- ============================================================================
-- 修复 get_subordinate_shippers_stats_1115 函数
-- 使用 parent_partner_id 递归查询
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
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- 设置日期范围默认值
    v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, CURRENT_DATE);

    -- 验证货主是否存在
    IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = p_shipper_id AND partner_type = '货主') THEN
        RAISE EXCEPTION '货主不存在或不是货主类型';
    END IF;

    -- ✅ 关键修复：使用递归查询获取本级和所有下级货主
    RETURN QUERY
    WITH RECURSIVE all_shippers AS (
        -- 起点：当前货主
        SELECT 
            id,
            name,
            parent_partner_id,
            0 as depth
        FROM public.partners
        WHERE id = p_shipper_id AND partner_type = '货主'
        
        UNION ALL
        
        -- 递归：查找所有下级
        SELECT 
            p.id,
            p.name,
            p.parent_partner_id,
            a.depth + 1
        FROM public.partners p
        INNER JOIN all_shippers a ON p.parent_partner_id = a.id
        WHERE p.partner_type = '货主'
          AND a.depth < 100  -- 防止无限循环
    )
    SELECT 
        a.id,
        a.name,
        a.depth,
        a.parent_partner_id,
        parent.name,
        COALESCE(stats.record_count, 0)::BIGINT,
        COALESCE(stats.total_weight, 0),
        COALESCE(stats.total_amount, 0),
        COALESCE(stats.active_projects, 0)::BIGINT,
        COALESCE(stats.pending_payments, 0)::BIGINT,
        COALESCE(stats.pending_invoices, 0)::BIGINT
    FROM all_shippers a
    LEFT JOIN public.partners parent ON a.parent_partner_id = parent.id
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
            AND lr.loading_date::date >= v_start_date
            AND lr.loading_date::date <= v_end_date
        WHERE pp.partner_id = a.id
    ) stats ON TRUE
    ORDER BY a.depth, a.name;
END;
$$;

COMMENT ON FUNCTION public.get_subordinate_shippers_stats_1115 IS '获取下级货主列表及统计数据（包含本级和下级）- 使用 parent_partner_id 递归查询';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复完成：货主看板查询逻辑';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '关键修复：';
    RAISE NOTICE '  - 不再依赖 hierarchy_path 字段';
    RAISE NOTICE '  - 使用 parent_partner_id 递归查询所有下级';
    RAISE NOTICE '  - 使用 WITH RECURSIVE 确保查询所有层级的下级';
    RAISE NOTICE '';
    RAISE NOTICE '查询逻辑：';
    RAISE NOTICE '  1. 使用 parent_partner_id 确定直接下级';
    RAISE NOTICE '  2. 递归查询所有间接下级';
    RAISE NOTICE '  3. 不依赖 hierarchy_path 字段（即使该字段未正确维护也能工作）';
    RAISE NOTICE '';
    RAISE NOTICE '已修复的函数：';
    RAISE NOTICE '  - get_shipper_dashboard_stats_1115()';
    RAISE NOTICE '  - get_subordinate_shippers_stats_1115()';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

