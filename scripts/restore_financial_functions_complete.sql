-- ============================================================================
-- 恢复财务看板相关函数（完整版本）
-- ============================================================================
-- 备份时间: 2025-11-02
-- 来源: 从数据库导出的实际函数定义
-- 用途: 恢复财务看板相关的原始函数
-- ============================================================================

-- ============================================================================
-- 函数1: get_total_receivables - 获取总应收
-- ============================================================================
-- 逻辑: 从 logistics_partner_costs 中取每个运单的最高级别成本
CREATE OR REPLACE FUNCTION public.get_total_receivables()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    total_amount NUMERIC;
BEGIN
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (logistics_record_id) -- 每个运单只取一行
            logistics_record_id,
            payable_amount
        FROM
            public.logistics_partner_costs
        ORDER BY
            logistics_record_id,
            level DESC -- 按 level 降序排序，最大的 level 在前
    )
    SELECT INTO total_amount SUM(h.payable_amount)
    FROM highest_level_costs h;

    RETURN COALESCE(total_amount, 0);
END;
$$;

COMMENT ON FUNCTION public.get_total_receivables() IS '获取总应收（我司应收总额，使用最高级别成本）';

-- ============================================================================
-- 函数2: get_monthly_receivables - 获取本月应收
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_monthly_receivables()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    total_amount NUMERIC;
BEGIN
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.logistics_record_id,
            lpc.payable_amount
        FROM
            public.logistics_partner_costs lpc
        JOIN
            public.logistics_records lr ON lpc.logistics_record_id = lr.id
        WHERE
            lr.created_at >= date_trunc('month', NOW()) AND
            lr.created_at < date_trunc('month', NOW()) + interval '1 month'
        ORDER BY
            lpc.logistics_record_id,
            lpc.level DESC -- 按 level 降序排序
    )
    SELECT INTO total_amount SUM(h.payable_amount)
    FROM highest_level_costs h;

    RETURN COALESCE(total_amount, 0);
END;
$$;

COMMENT ON FUNCTION public.get_monthly_receivables() IS '获取本月应收（当前月份，使用最高级别成本）';

-- ============================================================================
-- 函数3: get_pending_payments - 获取待付款金额
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_payments()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    total_amount NUMERIC;
BEGIN
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.logistics_record_id,
            lpc.payable_amount
        FROM
            public.logistics_partner_costs lpc
        JOIN
            public.logistics_records lr ON lpc.logistics_record_id = lr.id
        WHERE
            lr.payment_status = 'Unpaid'
        ORDER BY
            lpc.logistics_record_id,
            lpc.level DESC -- 按 level 降序排序
    )
    SELECT INTO total_amount SUM(h.payable_amount)
    FROM highest_level_costs h;

    RETURN COALESCE(total_amount, 0);
END;
$$;

COMMENT ON FUNCTION public.get_pending_payments() IS '获取待付款金额（付款状态为 Unpaid，使用最高级别成本）';

-- ============================================================================
-- 函数4: get_pending_invoicing - 获取待开票金额
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_invoicing()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    total_amount NUMERIC;
BEGIN
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.logistics_record_id,
            lpc.payable_amount
        FROM
            public.logistics_partner_costs lpc
        JOIN
            public.logistics_records lr ON lpc.logistics_record_id = lr.id
        WHERE
            lr.payment_status IS NULL OR lr.payment_status NOT IN ('Unpaid', 'Processing')
        ORDER BY
            lpc.logistics_record_id,
            lpc.level DESC -- 按 level 降序排序
    )
    SELECT INTO total_amount SUM(h.payable_amount)
    FROM highest_level_costs h;

    RETURN COALESCE(total_amount, 0);
END;
$$;

COMMENT ON FUNCTION public.get_pending_invoicing() IS '获取待开票金额（使用最高级别成本）';

-- ============================================================================
-- 函数5: get_monthly_trends - 获取月度趋势数据
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_monthly_trends()
RETURNS TABLE (
    month_start TEXT,
    total_receivables NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT date_trunc('month', generate_series(NOW() - interval '11 months', NOW(), '1 month'))::date AS month_date
    ),
    highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lr.created_at,
            lpc.payable_amount
        FROM
            public.logistics_partner_costs lpc
        JOIN
            public.logistics_records lr ON lpc.logistics_record_id = lr.id
        ORDER BY
            lpc.logistics_record_id,
            lpc.level DESC -- level 越大，级别越高
    )
    SELECT
        to_char(m.month_date, 'YYYY-MM') AS month_start,
        COALESCE(SUM(h.payable_amount), 0) AS total_receivables
    FROM
        months m
    LEFT JOIN
        highest_level_costs h ON date_trunc('month', h.created_at) = m.month_date
    GROUP BY
        m.month_date
    ORDER BY
        m.month_date;
END;
$$;

COMMENT ON FUNCTION public.get_monthly_trends() IS '获取月度趋势数据（最近12个月，使用最高级别成本）';

-- ============================================================================
-- 函数6: get_partner_ranking - 获取合作方排名数据
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_partner_ranking()
RETURNS TABLE (
    partner_name TEXT,
    total_payable NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH highest_level_costs AS (
        SELECT
            DISTINCT ON (lpc.logistics_record_id)
            lpc.partner_id,
            lpc.payable_amount
        FROM
            public.logistics_partner_costs lpc
        ORDER BY
            lpc.logistics_record_id,
            lpc.level DESC
    )
    SELECT
        p.name AS partner_name,
        SUM(h.payable_amount) AS total_payable
    FROM
        highest_level_costs h
    JOIN
        public.partners p ON h.partner_id = p.id
    GROUP BY
        p.name
    ORDER BY
        total_payable DESC
    LIMIT 10;
END;
$$;

COMMENT ON FUNCTION public.get_partner_ranking() IS '获取合作方排名数据（Top 10，使用最高级别成本）';

-- ============================================================================
-- 验证恢复结果
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 财务看板函数恢复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已恢复的函数:';
    RAISE NOTICE '  ✅ get_total_receivables()';
    RAISE NOTICE '  ✅ get_monthly_receivables()';
    RAISE NOTICE '  ✅ get_pending_payments()';
    RAISE NOTICE '  ✅ get_pending_invoicing()';
    RAISE NOTICE '  ✅ get_monthly_trends()';
    RAISE NOTICE '  ✅ get_partner_ranking()';
    RAISE NOTICE '';
    RAISE NOTICE '所有函数都使用 highest_level_costs 逻辑';
    RAISE NOTICE '（每个运单只取最高级别的成本）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- 检查函数是否创建成功
SELECT 
    '恢复验证' as verification,
    proname as function_name,
    CASE 
        WHEN proname IN (
            'get_total_receivables',
            'get_monthly_receivables',
            'get_pending_payments',
            'get_pending_invoicing',
            'get_monthly_trends',
            'get_partner_ranking'
        ) THEN '✅ 已恢复'
        ELSE '❌ 未找到'
    END as status,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
    'get_total_receivables',
    'get_monthly_receivables',
    'get_pending_payments',
    'get_pending_invoicing',
    'get_monthly_trends',
    'get_partner_ranking'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

