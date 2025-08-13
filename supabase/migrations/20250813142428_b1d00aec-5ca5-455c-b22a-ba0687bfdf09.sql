-- 创建优化的财务对账数据查询函数，支持billing_type_id动态展示
CREATE OR REPLACE FUNCTION public.get_finance_reconciliation_data_optimized(
    p_project_id uuid DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  v_offset := (p_page_number - 1) * p_page_size;

  WITH filtered_logistics AS (
    SELECT 
      lr.id,
      lr.auto_number,
      lr.project_name,
      lr.driver_name,
      lr.loading_location,
      lr.unloading_location,
      lr.loading_date,
      lr.unloading_date,
      lr.loading_weight,
      lr.unloading_weight,
      lr.current_cost,
      lr.extra_cost,
      lr.payable_cost,
      lr.billing_type_id -- 包含billing_type_id
    FROM logistics_records lr
    WHERE 
      (p_project_id IS NULL OR lr.project_id = p_project_id) AND
      (p_start_date IS NULL OR lr.loading_date >= p_start_date::date) AND
      (p_end_date IS NULL OR lr.loading_date <= p_end_date::date) AND
      (p_partner_id IS NULL OR EXISTS (
        SELECT 1 FROM logistics_partner_costs lpc
        WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
      ))
  ),
  paginated_records AS (
    SELECT *
    FROM filtered_logistics
    ORDER BY loading_date DESC, auto_number DESC
    LIMIT p_page_size
    OFFSET v_offset
  ),
  total_count AS (
    SELECT COUNT(*) as count FROM filtered_logistics
  ),
  records_with_partners AS (
    SELECT 
      pr.*,
      COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'partner_id', lpc.partner_id,
            'partner_name', p.name,
            'level', lpc.level,
            'payable_amount', lpc.payable_amount
          ) ORDER BY lpc.level
        )
        FROM logistics_partner_costs lpc
        JOIN partners p ON lpc.partner_id = p.id
        WHERE lpc.logistics_record_id = pr.id),
        '[]'::jsonb
      ) as partner_costs
    FROM paginated_records pr
  )
  SELECT jsonb_build_object(
    'records', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', rwp.id,
        'auto_number', rwp.auto_number,
        'project_name', rwp.project_name,
        'driver_name', rwp.driver_name,
        'loading_location', rwp.loading_location,
        'unloading_location', rwp.unloading_location,
        'loading_date', TO_CHAR(rwp.loading_date, 'YYYY-MM-DD'),
        'unloading_date', CASE WHEN rwp.unloading_date IS NOT NULL THEN TO_CHAR(rwp.unloading_date, 'YYYY-MM-DD') ELSE NULL END,
        'loading_weight', rwp.loading_weight,
        'unloading_weight', rwp.unloading_weight,
        'current_cost', rwp.current_cost,
        'extra_cost', rwp.extra_cost,
        'payable_cost', rwp.payable_cost,
        'billing_type_id', rwp.billing_type_id, -- 包含billing_type_id
        'partner_costs', rwp.partner_costs
      ) ORDER BY rwp.loading_date DESC, rwp.auto_number DESC
    ), '[]'::jsonb),
    'count', (SELECT count FROM total_count),
    'total_pages', CASE 
      WHEN (SELECT count FROM total_count) = 0 THEN 1 
      ELSE CEIL((SELECT count FROM total_count)::float / p_page_size::float)::integer 
    END,
    'overview', (
      SELECT jsonb_build_object(
        'total_records', COUNT(*),
        'total_current_cost', COALESCE(SUM(current_cost), 0),
        'total_extra_cost', COALESCE(SUM(extra_cost), 0),
        'total_payable_cost', COALESCE(SUM(payable_cost), 0)
      )
      FROM filtered_logistics
    ),
    'partner_summary', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'partner_id', lpc.partner_id,
          'partner_name', p.name,
          'level', lpc.level,
          'total_payable', SUM(lpc.payable_amount),
          'records_count', COUNT(DISTINCT lpc.logistics_record_id)
        ) ORDER BY lpc.level
      ), '[]'::jsonb)
      FROM filtered_logistics fl
      JOIN logistics_partner_costs lpc ON fl.id = lpc.logistics_record_id
      JOIN partners p ON lpc.partner_id = p.id
      GROUP BY lpc.partner_id, p.name, lpc.level
    )
  )
  INTO v_result
  FROM records_with_partners rwp, total_count;

  RETURN v_result;
END;
$$;

-- 创建索引以提升性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_billing_type 
ON logistics_records (billing_type_id, loading_date DESC);

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_partner_record 
ON logistics_partner_costs (partner_id, logistics_record_id, level);