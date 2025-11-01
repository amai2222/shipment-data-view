-- ============================================================================
-- 备份财务看板相关 RPC 函数
-- ============================================================================
-- 备份时间: 2025-11-02
-- 用途: 保存财务看板相关的原始函数定义，以便在需要时恢复
-- ============================================================================

-- ============================================================================
-- 方法1: 导出当前数据库中的函数定义
-- ============================================================================
-- 在 Supabase SQL Editor 中运行以下查询，获取所有函数的完整定义

-- 1. 查询所有财务看板相关的函数
SELECT 
    '函数列表' as section,
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    prorettype::regtype as return_type,
    CASE 
        WHEN proname = 'get_total_receivables' THEN '获取总应收'
        WHEN proname = 'get_monthly_receivables' THEN '获取本月应收'
        WHEN proname = 'get_pending_payments' THEN '获取待付款金额'
        WHEN proname = 'get_pending_invoicing' THEN '获取待开票金额'
        WHEN proname = 'get_monthly_trends' THEN '获取月度趋势'
        WHEN proname = 'get_partner_ranking' THEN '获取合作方排名'
        ELSE '其他函数'
    END as description
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

-- 2. 导出所有函数的完整定义
SELECT 
    '完整函数定义' as section,
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
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

-- 3. 显示函数源代码
SELECT 
    '函数源代码' as section,
    proname as function_name,
    prosrc as source_code,
    pg_get_function_identity_arguments(oid) as identity_args
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

-- 4. 检查函数依赖关系
SELECT 
    '依赖关系' as section,
    p1.proname as function_name,
    objid::regprocedure as depends_on_function,
    refobjid::regprocedure as referenced_function
FROM pg_depend d
JOIN pg_proc p1 ON d.objid = p1.oid
JOIN pg_proc p2 ON d.refobjid = p2.oid
WHERE p1.proname IN (
    'get_total_receivables',
    'get_monthly_receivables',
    'get_pending_payments',
    'get_pending_invoicing',
    'get_monthly_trends',
    'get_partner_ranking'
)
AND p1.pronamespace = 'public'::regnamespace;

-- ============================================================================
-- 方法2: 手动备份（如果上面的查询有结果）
-- ============================================================================
-- 如果函数存在但没有找到完整定义，请手动复制以下内容：

-- ============================================================================
-- 函数1: get_total_receivables - 获取总应收
-- ============================================================================
-- 注意：实际函数定义请从上面的查询结果中复制
/*
CREATE OR REPLACE FUNCTION public.get_total_receivables()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(payable_cost), 0)
        FROM public.logistics_records
        WHERE payable_cost IS NOT NULL
    );
END;
$$;

COMMENT ON FUNCTION public.get_total_receivables() IS '获取总应收（我司应收总额）';
*/

-- ============================================================================
-- 函数2: get_monthly_receivables - 获取本月应收
-- ============================================================================
/*
CREATE OR REPLACE FUNCTION public.get_monthly_receivables()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(payable_cost), 0)
        FROM public.logistics_records
        WHERE payable_cost IS NOT NULL
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    );
END;
$$;

COMMENT ON FUNCTION public.get_monthly_receivables() IS '获取本月应收（当前月份）';
*/

-- ============================================================================
-- 函数3: get_pending_payments - 获取待付款金额
-- ============================================================================
/*
CREATE OR REPLACE FUNCTION public.get_pending_payments()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            SUM(
                (SELECT SUM(lr.payable_cost)
                 FROM public.logistics_records lr
                 WHERE lr.id = ANY(pr.logistics_record_ids)
                   AND lr.payable_cost IS NOT NULL)
            ), 0
        )
        FROM public.payment_requests pr
        WHERE pr.status IN ('Pending', 'Approved')
    );
END;
$$;

COMMENT ON FUNCTION public.get_pending_payments() IS '获取待付款金额（付款申请状态为 Pending 或 Approved）';
*/

-- ============================================================================
-- 函数4: get_pending_invoicing - 获取待开票金额
-- ============================================================================
/*
CREATE OR REPLACE FUNCTION public.get_pending_invoicing()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
    RETURN (
        WITH unpaid_invoices AS (
            SELECT COALESCE(SUM(payable_cost), 0) as amount
            FROM public.logistics_records
            WHERE (invoice_status IS NULL OR invoice_status = 'Uninvoiced')
              AND payable_cost IS NOT NULL
        ),
        pending_invoice_requests AS (
            SELECT COALESCE(
                SUM(
                    (SELECT SUM(lr.payable_cost)
                     FROM public.logistics_records lr
                     JOIN public.invoice_request_details ird ON lr.id = ird.logistics_record_id
                     WHERE ird.invoice_request_id = ir.id
                       AND lr.payable_cost IS NOT NULL)
                ), 0
            ) as amount
            FROM public.invoice_requests ir
            WHERE ir.status IN ('Pending', 'Approved')
        )
        SELECT COALESCE(
            (SELECT amount FROM unpaid_invoices) +
            (SELECT amount FROM pending_invoice_requests),
            0
        );
    );
END;
$$;

COMMENT ON FUNCTION public.get_pending_invoicing() IS '获取待开票金额（未开票的运单 + 待审批的开票申请）';
*/

-- ============================================================================
-- 函数5: get_monthly_trends - 获取月度趋势数据
-- ============================================================================
/*
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
    SELECT 
        to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') as month_start,
        COALESCE(SUM(payable_cost), 0) as total_receivables
    FROM public.logistics_records
    WHERE payable_cost IS NOT NULL
      AND created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month_start DESC
    LIMIT 12;
END;
$$;

COMMENT ON FUNCTION public.get_monthly_trends() IS '获取月度趋势数据（最近12个月）';
*/

-- ============================================================================
-- 函数6: get_partner_ranking - 获取合作方排名数据
-- ============================================================================
/*
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
    SELECT 
        COALESCE(p.name, p.full_name, '未知合作方')::TEXT as partner_name,
        COALESCE(SUM(lpc.payable_amount), 0) as total_payable
    FROM public.logistics_partner_costs lpc
    JOIN public.partners p ON lpc.partner_id = p.id
    WHERE lpc.payable_amount IS NOT NULL
    GROUP BY p.id, p.name, p.full_name
    ORDER BY total_payable DESC
    LIMIT 10;
END;
$$;

COMMENT ON FUNCTION public.get_partner_ranking() IS '获取合作方排名数据（Top 10）';
*/

-- ============================================================================
-- 恢复方法
-- ============================================================================
-- 
-- 如果需要恢复旧函数：
-- 
-- 1. 运行上面的查询（方法1），获取所有函数的完整定义
-- 2. 复制每个函数的 function_definition 字段内容
-- 3. 在 Supabase SQL Editor 中执行这些函数定义
-- 4. 或者使用 scripts/restore_financial_functions.sql 脚本（如果存在）
-- 
-- ============================================================================

-- ============================================================================
-- 备份完成
-- ============================================================================

