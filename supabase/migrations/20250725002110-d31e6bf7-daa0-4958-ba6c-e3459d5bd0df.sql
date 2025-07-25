-- 创建运单筛选函数（为运单录入页面使用）
CREATE OR REPLACE FUNCTION public.get_filtered_logistics_records(
  p_project_id UUID DEFAULT NULL,
  p_driver_id UUID DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
  id UUID,
  auto_number TEXT,
  project_id UUID,
  project_name TEXT,
  chain_id UUID,
  loading_date TEXT,
  loading_location TEXT,
  unloading_location TEXT,
  driver_id UUID,
  driver_name TEXT,
  license_plate TEXT,
  driver_phone TEXT,
  loading_weight NUMERIC,
  unloading_date TEXT,
  unloading_weight NUMERIC,
  transport_type TEXT,
  current_cost NUMERIC,
  extra_cost NUMERIC,
  payable_cost NUMERIC,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id TEXT,
  total_count BIGINT
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_records BIGINT;
BEGIN
  -- 首先获取总记录数
  SELECT COUNT(*)
  INTO total_records
  FROM public.logistics_records lr
  WHERE 
    (p_project_id IS NULL OR lr.project_id = p_project_id) AND
    (p_driver_id IS NULL OR lr.driver_id = p_driver_id) AND
    (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
    (p_end_date IS NULL OR lr.loading_date <= p_end_date);

  -- 返回分页数据
  RETURN QUERY
  SELECT 
    lr.id,
    lr.auto_number,
    lr.project_id,
    lr.project_name,
    lr.chain_id,
    lr.loading_date,
    lr.loading_location,
    lr.unloading_location,
    lr.driver_id,
    lr.driver_name,
    lr.license_plate,
    lr.driver_phone,
    lr.loading_weight,
    lr.unloading_date,
    lr.unloading_weight,
    lr.transport_type,
    lr.current_cost,
    lr.extra_cost,
    lr.payable_cost,
    lr.remarks,
    lr.created_at,
    lr.created_by_user_id,
    total_records as total_count
  FROM public.logistics_records lr
  WHERE 
    (p_project_id IS NULL OR lr.project_id = p_project_id) AND
    (p_driver_id IS NULL OR lr.driver_id = p_driver_id) AND
    (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
    (p_end_date IS NULL OR lr.loading_date <= p_end_date)
  ORDER BY lr.loading_date DESC, lr.auto_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$