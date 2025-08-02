-- Fix the get_filtered_logistics_records function to handle timestamp comparisons
CREATE OR REPLACE FUNCTION public.get_filtered_logistics_records(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_driver_id uuid DEFAULT NULL::uuid, 
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_limit integer DEFAULT 100, 
    p_offset integer DEFAULT 0
)
RETURNS TABLE(
    id uuid, auto_number text, project_id uuid, project_name text, chain_id uuid, 
    loading_date timestamp with time zone, loading_location text, unloading_location text, 
    driver_id uuid, driver_name text, license_plate text, driver_phone text, 
    loading_weight numeric, unloading_date timestamp with time zone, unloading_weight numeric, 
    transport_type text, current_cost numeric, extra_cost numeric, payable_cost numeric, 
    remarks text, created_at timestamp with time zone, created_by_user_id text, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_records BIGINT;
BEGIN
  -- First get total record count
  SELECT COUNT(*)
  INTO total_records
  FROM public.logistics_records lr
  WHERE 
    (p_project_id IS NULL OR lr.project_id = p_project_id) AND
    (p_driver_id IS NULL OR lr.driver_id = p_driver_id) AND
    (p_start_date IS NULL OR lr.loading_date >= p_start_date::timestamp with time zone) AND
    (p_end_date IS NULL OR lr.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone);

  -- Return paginated data
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
    (p_start_date IS NULL OR lr.loading_date >= p_start_date::timestamp with time zone) AND
    (p_end_date IS NULL OR lr.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone)
  ORDER BY lr.loading_date DESC, lr.auto_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;