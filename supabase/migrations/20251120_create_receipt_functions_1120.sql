-- ============================================================================
-- 创建收款相关函数 _1120 版本
-- 创建日期：2025-11-20
-- 功能：基于 _1114 版本创建 _1120 版本的收款统计和详情报表函数
-- ============================================================================

-- ============================================================================
-- 1. get_receipt_statistics_1120
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_receipt_statistics_1120(
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

COMMENT ON FUNCTION public.get_receipt_statistics_1120 IS '获取收款统计信息（_1120版本）';

-- ============================================================================
-- 2. get_receipt_details_report_1120
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_receipt_details_report_1120(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_records JSONB;
    v_total_count INTEGER;
    v_offset INTEGER;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 获取总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.invoice_requests ir
    WHERE (p_start_date IS NULL OR DATE(ir.created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(ir.created_at) <= p_end_date)
      AND (p_partner_id IS NULL OR ir.invoicing_partner_id = p_partner_id)
      AND (p_status IS NULL OR ir.status = p_status);
    
    -- 获取详情记录（使用子查询先排序，再聚合，避免GROUP BY错误）
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ir.id,
            'request_number', ir.request_number,
            'partner_name', COALESCE((SELECT full_name FROM partners WHERE id = ir.partner_id), ir.partner_name),
            'invoicing_partner_id', ir.invoicing_partner_id,
            'invoicing_partner_full_name', ir.invoicing_partner_full_name,
            'total_amount', ir.total_amount,
            'total_received_amount', COALESCE(ir.total_received_amount, 0),
            'remaining_amount', ir.total_amount - COALESCE(ir.total_received_amount, 0),
            'receipt_rate', CASE 
                WHEN ir.total_amount > 0 THEN 
                    ROUND((COALESCE(ir.total_received_amount, 0) / ir.total_amount * 100)::numeric, 2)
                ELSE 0 
            END,
            'payment_due_date', ir.payment_due_date,
            'overdue_days', COALESCE(ir.overdue_days, 0),
            'reminder_count', COALESCE(ir.reminder_count, 0),
            'status', ir.status,
            'reconciliation_status', COALESCE(ir.reconciliation_status, 'Unreconciled'),
            'created_at', ir.created_at,
            'received_at', (
                SELECT MAX(receipt_date) 
                FROM invoice_receipt_records 
                WHERE invoice_request_id = ir.id
            )
        )
    ) INTO v_records
    FROM (
        SELECT ir.*
        FROM public.invoice_requests ir
        WHERE (p_start_date IS NULL OR DATE(ir.created_at) >= p_start_date)
          AND (p_end_date IS NULL OR DATE(ir.created_at) <= p_end_date)
          AND (p_partner_id IS NULL OR ir.invoicing_partner_id = p_partner_id)
          AND (p_status IS NULL OR ir.status = p_status)
        ORDER BY ir.created_at DESC
        LIMIT p_page_size OFFSET v_offset
    ) ir;
    
    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', p_page_number,
        'page_size', p_page_size,
        'total_pages', CEIL(v_total_count::NUMERIC / NULLIF(p_page_size, 1))
    );
END;
$$;

COMMENT ON FUNCTION public.get_receipt_details_report_1120 IS '获取收款详情报表（_1120版本，已修复GROUP BY错误）';

-- ============================================================================
-- 验证
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 收款相关函数 _1120 版本已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已创建函数：';
    RAISE NOTICE '  • get_receipt_statistics_1120';
    RAISE NOTICE '  • get_receipt_details_report_1120';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

