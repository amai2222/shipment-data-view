-- ============================================================================
-- 创建财务看板统一数据获取函数
-- ============================================================================
-- 功能：一次性获取财务看板所需的所有数据，减少多次RPC调用
-- 优化：提升财务看板加载性能，减少数据库往返次数
-- 注意：此函数不包含权限判断，权限控制由 RLS 策略和前端处理
-- ============================================================================
-- 创建时间: 2025-11-02
-- ============================================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_financial_overview_data();

-- 创建统一的财务看板数据获取函数
CREATE OR REPLACE FUNCTION public.get_financial_overview_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    v_result JSONB;
    v_total_receivables NUMERIC := 0;
    v_monthly_receivables NUMERIC := 0;
    v_pending_payment NUMERIC := 0;
    v_pending_invoice NUMERIC := 0;
    v_monthly_trends JSONB;
    v_partner_ranking JSONB;
BEGIN
    -- 1. 获取总应收（我司应收总额）- 使用最高级别成本
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (logistics_record_id)
            logistics_record_id,
            payable_amount
        FROM public.logistics_partner_costs
        ORDER BY logistics_record_id, level DESC
    )
    SELECT COALESCE(SUM(payable_amount), 0) INTO v_total_receivables
    FROM highest_level_costs;

    -- 2. 获取本月应收（当前月份）- 使用最高级别成本
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.logistics_record_id,
            lpc.payable_amount
        FROM public.logistics_partner_costs lpc
        JOIN public.logistics_records lr ON lpc.logistics_record_id = lr.id
        WHERE lr.created_at >= date_trunc('month', NOW())
          AND lr.created_at < date_trunc('month', NOW()) + interval '1 month'
        ORDER BY lpc.logistics_record_id, lpc.level DESC
    )
    SELECT COALESCE(SUM(payable_amount), 0) INTO v_monthly_receivables
    FROM highest_level_costs;

    -- 3. 获取待付款金额（付款状态为 Unpaid）- 使用最高级别成本
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.logistics_record_id,
            lpc.payable_amount
        FROM public.logistics_partner_costs lpc
        JOIN public.logistics_records lr ON lpc.logistics_record_id = lr.id
        WHERE lr.payment_status = 'Unpaid'
        ORDER BY lpc.logistics_record_id, lpc.level DESC
    )
    SELECT COALESCE(SUM(payable_amount), 0) INTO v_pending_payment
    FROM highest_level_costs;

    -- 4. 获取待开票金额 - 使用最高级别成本
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.logistics_record_id,
            lpc.payable_amount
        FROM public.logistics_partner_costs lpc
        JOIN public.logistics_records lr ON lpc.logistics_record_id = lr.id
        WHERE lr.payment_status IS NULL OR lr.payment_status NOT IN ('Unpaid', 'Processing')
        ORDER BY lpc.logistics_record_id, lpc.level DESC
    )
    SELECT COALESCE(SUM(payable_amount), 0) INTO v_pending_invoice
    FROM highest_level_costs;

    -- 5. 获取月度趋势数据（最近12个月）- 使用最高级别成本
    WITH months AS (
        SELECT date_trunc('month', generate_series(NOW() - interval '11 months', NOW(), '1 month'))::date AS month_date
    ),
    highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lr.created_at,
            lpc.payable_amount
        FROM public.logistics_partner_costs lpc
        JOIN public.logistics_records lr ON lpc.logistics_record_id = lr.id
        ORDER BY lpc.logistics_record_id, lpc.level DESC
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'month_start', to_char(m.month_date, 'YYYY-MM'),
            'total_receivables', COALESCE(SUM(h.payable_amount), 0)
        ) ORDER BY m.month_date
    ), '[]'::jsonb) INTO v_monthly_trends
    FROM months m
    LEFT JOIN highest_level_costs h ON date_trunc('month', h.created_at) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date;

    -- 6. 获取合作方排名数据（Top 10）- 使用最高级别成本
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.partner_id,
            lpc.payable_amount
        FROM public.logistics_partner_costs lpc
        ORDER BY lpc.logistics_record_id, lpc.level DESC
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'partner_name', partner_name,
            'total_payable', total_payable
        ) ORDER BY total_payable DESC
    ), '[]'::jsonb) INTO v_partner_ranking
    FROM (
        SELECT 
            p.name AS partner_name,
            SUM(h.payable_amount) AS total_payable
        FROM highest_level_costs h
        JOIN public.partners p ON h.partner_id = p.id
        GROUP BY p.name
        ORDER BY total_payable DESC
        LIMIT 10
    ) ranking;

    -- 7. 组合所有数据返回
    v_result := jsonb_build_object(
        'stats', jsonb_build_object(
            'totalReceivables', v_total_receivables,
            'monthlyReceivables', v_monthly_receivables,
            'pendingPayment', v_pending_payment,
            'pendingInvoice', v_pending_invoice
        ),
        'monthlyTrend', v_monthly_trends,
        'partnerRanking', v_partner_ranking,
        'projectContribution', '[]'::jsonb  -- 暂时为空，可后续添加
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_financial_overview_data() IS '获取财务看板所需的所有数据（统一函数，优化性能）';

-- 验证函数创建成功
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 财务看板统一数据函数创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '函数: get_financial_overview_data()';
    RAISE NOTICE '返回: JSONB 对象包含所有财务看板数据';
    RAISE NOTICE '';
    RAISE NOTICE '数据结构:';
    RAISE NOTICE '  - stats: 基础统计数据';
    RAISE NOTICE '  - monthlyTrend: 月度趋势数据';
    RAISE NOTICE '  - partnerRanking: 合作方排名';
    RAISE NOTICE '  - projectContribution: 项目贡献（待实现）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

