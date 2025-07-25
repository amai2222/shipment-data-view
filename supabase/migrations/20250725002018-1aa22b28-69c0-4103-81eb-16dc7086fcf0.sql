-- 创建合作方应付汇总函数
CREATE OR REPLACE FUNCTION public.get_partner_payables_summary(
  p_project_id UUID DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL
) RETURNS TABLE(
  partner_id UUID,
  partner_name TEXT,
  level INTEGER,
  total_payable NUMERIC,
  records_count BIGINT
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    lpc.partner_id,
    p.name as partner_name,
    lpc.level,
    SUM(lpc.payable_amount) as total_payable,
    COUNT(DISTINCT lpc.logistics_record_id) as records_count
  FROM public.logistics_partner_costs lpc
  JOIN public.partners p ON lpc.partner_id = p.id
  JOIN public.logistics_records lr ON lpc.logistics_record_id = lr.id
  WHERE 
    (p_project_id IS NULL OR lr.project_id = p_project_id) AND
    (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
    (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
    (p_partner_id IS NULL OR lpc.partner_id = p_partner_id)
  GROUP BY lpc.partner_id, p.name, lpc.level
  ORDER BY lpc.level ASC;
END;
$function$