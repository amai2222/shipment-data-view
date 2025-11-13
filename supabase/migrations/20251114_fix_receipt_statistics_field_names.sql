-- 修复收款统计函数返回字段名，使其与前端期望一致
-- 前端期望的字段：total_invoiced, total_received, total_unreceived, receipt_rate, overdue_amount, overdue_count

CREATE OR REPLACE FUNCTION public.get_receipt_statistics_1114(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_stats JSONB;
BEGIN
    WITH stats AS (
        SELECT 
            COALESCE(SUM(total_amount), 0) AS total_invoiced,
            COALESCE(SUM(total_received_amount), 0) AS total_received,
            COALESCE(SUM(total_amount - COALESCE(total_received_amount, 0)), 0) AS total_unreceived,
            COUNT(*) FILTER (WHERE payment_due_date < CURRENT_DATE AND status = 'Completed' AND COALESCE(total_received_amount, 0) < total_amount) AS overdue_count,
            COALESCE(SUM(total_amount - COALESCE(total_received_amount, 0)) FILTER (WHERE payment_due_date < CURRENT_DATE AND status = 'Completed' AND COALESCE(total_received_amount, 0) < total_amount), 0) AS overdue_amount
        FROM public.invoice_requests
        WHERE (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
          AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
          AND (p_partner_id IS NULL OR invoicing_partner_id = p_partner_id)
    )
    SELECT jsonb_build_object(
        'total_invoiced', stats.total_invoiced,
        'total_received', stats.total_received,
        'total_unreceived', stats.total_unreceived,
        'receipt_rate', CASE 
            WHEN stats.total_invoiced > 0 THEN 
                ROUND((stats.total_received / stats.total_invoiced * 100)::numeric, 2)
            ELSE 0 
        END,
        'overdue_amount', stats.overdue_amount,
        'overdue_count', stats.overdue_count
    ) INTO v_stats
    FROM stats;

    RETURN jsonb_build_object('success', true, 'statistics', v_stats);
END;
$$;

COMMENT ON FUNCTION public.get_receipt_statistics_1114 IS '获取收款统计信息（_1114版本，字段名已修复）';

