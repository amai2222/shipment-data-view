-- 创建财务对账筛选函数
CREATE OR REPLACE FUNCTION public.get_finance_reconciliation_data(
  p_project_id UUID DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL
) RETURNS TABLE(
  record_id UUID,
  auto_number TEXT,
  project_name TEXT,
  driver_name TEXT,
  loading_location TEXT,
  unloading_location TEXT,
  loading_date TEXT,
  current_cost NUMERIC,
  payable_cost NUMERIC,
  partner_costs JSONB
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    lr.id as record_id,
    lr.auto_number,
    lr.project_name,
    lr.driver_name,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_date,
    lr.current_cost,
    lr.payable_cost,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'partner_id', lpc.partner_id,
          'partner_name', p.name,
          'level', lpc.level,
          'payable_amount', lpc.payable_amount
        ) ORDER BY lpc.level
      ) FILTER (WHERE lpc.partner_id IS NOT NULL),
      '[]'::jsonb
    ) as partner_costs
  FROM public.logistics_records lr
  LEFT JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
  LEFT JOIN public.partners p ON lpc.partner_id = p.id
  WHERE 
    (p_project_id IS NULL OR lr.project_id = p_project_id) AND
    (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
    (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
    (p_partner_id IS NULL OR EXISTS (
      SELECT 1 FROM public.logistics_partner_costs lpc2 
      WHERE lpc2.logistics_record_id = lr.id AND lpc2.partner_id = p_partner_id
    ))
  GROUP BY lr.id, lr.auto_number, lr.project_name, lr.driver_name, 
           lr.loading_location, lr.unloading_location, lr.loading_date,
           lr.current_cost, lr.payable_cost
  ORDER BY lr.loading_date DESC, lr.auto_number DESC;
END;
$function$