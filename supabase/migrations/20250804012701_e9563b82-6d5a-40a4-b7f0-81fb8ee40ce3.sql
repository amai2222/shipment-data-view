-- 创建获取付款开票数据的函数
CREATE OR REPLACE FUNCTION public.get_payment_invoice_data(
  p_project_ids UUID[] DEFAULT NULL,
  p_partner_ids UUID[] DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_page_number INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  v_offset := (p_page_number - 1) * p_page_size;

  WITH logistics_with_payments AS (
    SELECT 
      lr.id,
      lr.auto_number,
      lr.project_name,
      lr.driver_name,
      lr.loading_location,
      lr.unloading_location,
      lr.loading_date,
      lr.loading_weight,
      lr.unloading_weight,
      -- 合作方成本信息
      lpc.partner_id,
      p.name as partner_name,
      lpc.level,
      lpc.payable_amount as partner_payable,
      -- 付款信息汇总
      COALESCE(payment_summary.total_paid, 0) as paid_amount,
      COALESCE(payment_summary.latest_payment_date, NULL) as latest_payment_date,
      -- 开票信息汇总  
      COALESCE(invoice_summary.total_invoiced, 0) as invoiced_amount,
      COALESCE(invoice_summary.latest_invoice_date, NULL) as latest_invoice_date,
      -- 状态计算
      CASE 
        WHEN COALESCE(payment_summary.total_paid, 0) >= lpc.payable_amount THEN '已付款'
        WHEN COALESCE(payment_summary.total_paid, 0) > 0 THEN '部分付款'
        ELSE '待付款'
      END as payment_status,
      CASE 
        WHEN COALESCE(invoice_summary.total_invoiced, 0) >= lpc.payable_amount THEN '已开票'
        WHEN COALESCE(invoice_summary.total_invoiced, 0) > 0 THEN '部分开票'
        ELSE '待开票'
      END as invoice_status
    FROM logistics_records lr
    LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
    LEFT JOIN partners p ON lpc.partner_id = p.id
    -- 付款汇总子查询
    LEFT JOIN (
      SELECT 
        logistics_record_id,
        partner_id,
        SUM(payment_amount) as total_paid,
        MAX(payment_date) as latest_payment_date
      FROM payment_records 
      GROUP BY logistics_record_id, partner_id
    ) payment_summary ON lr.id = payment_summary.logistics_record_id AND lpc.partner_id = payment_summary.partner_id
    -- 开票汇总子查询
    LEFT JOIN (
      SELECT 
        logistics_record_id,
        partner_id,
        SUM(invoice_amount) as total_invoiced,
        MAX(invoice_date) as latest_invoice_date
      FROM invoice_records 
      GROUP BY logistics_record_id, partner_id
    ) invoice_summary ON lr.id = invoice_summary.logistics_record_id AND lpc.partner_id = invoice_summary.partner_id
    WHERE 
      (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids)) AND
      (p_partner_ids IS NULL OR lpc.partner_id = ANY(p_partner_ids)) AND
      (p_start_date IS NULL OR lr.loading_date >= p_start_date::date) AND
      (p_end_date IS NULL OR lr.loading_date <= p_end_date::date)
  ),
  paginated_records AS (
    SELECT *
    FROM logistics_with_payments
    ORDER BY loading_date DESC, auto_number DESC
    LIMIT p_page_size
    OFFSET v_offset
  ),
  total_count AS (
    SELECT COUNT(*) as count FROM logistics_with_payments
  )
  SELECT JSONB_BUILD_OBJECT(
    'records', COALESCE(JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', pr.id,
        'auto_number', pr.auto_number,
        'project_name', pr.project_name,
        'partner_id', pr.partner_id,
        'partner_name', pr.partner_name,
        'driver_name', pr.driver_name,
        'loading_date', TO_CHAR(pr.loading_date, 'YYYY-MM-DD'),
        'route', CONCAT(pr.loading_location, ' → ', pr.unloading_location),
        'loading_weight', pr.loading_weight,
        'partner_payable', pr.partner_payable,
        'paid_amount', pr.paid_amount,
        'invoiced_amount', pr.invoiced_amount,
        'pending_payment', (pr.partner_payable - pr.paid_amount),
        'pending_invoice', (pr.partner_payable - pr.invoiced_amount),
        'payment_status', pr.payment_status,
        'invoice_status', pr.invoice_status,
        'latest_payment_date', pr.latest_payment_date,
        'latest_invoice_date', pr.latest_invoice_date,
        'level', pr.level
      )
    ), '[]'::JSONB),
    'total_count', (SELECT count FROM total_count),
    'summary', (
      SELECT JSONB_BUILD_OBJECT(
        'total_records', COUNT(*),
        'total_payable', SUM(partner_payable),
        'total_paid', SUM(paid_amount),
        'total_invoiced', SUM(invoiced_amount),
        'total_pending_payment', SUM(partner_payable - paid_amount),
        'total_pending_invoice', SUM(partner_payable - invoiced_amount)
      )
      FROM logistics_with_payments
    )
  )
  INTO v_result
  FROM paginated_records pr, total_count;

  RETURN v_result;
END;
$$;