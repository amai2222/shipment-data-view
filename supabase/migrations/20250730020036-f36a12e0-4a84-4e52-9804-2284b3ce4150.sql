-- 修复运单导入时自动生成运单编号的问题
-- 更新 add_logistics_record_with_costs 函数，确保自动生成 auto_number

CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs(
    p_project_id uuid, 
    p_project_name text, 
    p_chain_id uuid, 
    p_driver_id uuid, 
    p_driver_name text, 
    p_loading_location text, 
    p_unloading_location text, 
    p_loading_date text, 
    p_loading_weight numeric, 
    p_unloading_weight numeric, 
    p_current_cost numeric, 
    p_license_plate text, 
    p_driver_phone text, 
    p_transport_type text, 
    p_extra_cost numeric, 
    p_remarks text, 
    p_unloading_date text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_record_id uuid;
  driver_payable numeric;
  v_project_code text;
  v_auto_number text;
BEGIN
  -- 【核心修复】在插入运单前，先检查并确保项目有 `auto_code`
  SELECT auto_code INTO v_project_code FROM public.projects WHERE id = p_project_id;
  IF v_project_code IS NULL OR v_project_code = '' THEN
    v_project_code := UPPER(SUBSTRING(p_project_name, 1, 4));
    UPDATE public.projects SET auto_code = v_project_code WHERE id = p_project_id;
  END IF;

  -- 【关键修复】生成运单自动编号
  v_auto_number := public.generate_auto_number(p_loading_date);

  driver_payable := (COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0));

  INSERT INTO public.logistics_records (
    auto_number,
    project_id, project_name, chain_id, driver_id, driver_name, loading_location, unloading_location,
    loading_date, unloading_date, loading_weight, unloading_weight, current_cost,
    license_plate, driver_phone, transport_type, extra_cost, remarks,
    payable_cost, created_by_user_id
  ) VALUES (
    v_auto_number,
    p_project_id, p_project_name, p_chain_id, p_driver_id, p_driver_name, p_loading_location, p_unloading_location,
    p_loading_date, p_unloading_date, p_loading_weight, p_unloading_weight, p_current_cost,
    p_license_plate, p_driver_phone, p_transport_type, p_extra_cost, p_remarks,
    driver_payable, 'system'
  ) RETURNING id INTO new_record_id;

  PERFORM public.recalculate_and_update_costs_for_record(new_record_id);

END;
$function$;