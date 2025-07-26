-- Add missing database functions that are used in the application

-- Function to get or create driver
CREATE OR REPLACE FUNCTION public.get_or_create_driver(p_driver_name text, p_license_plate text, p_phone text)
RETURNS TABLE(driver_id uuid, driver_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  found_id uuid;
BEGIN
  IF p_driver_name IS NULL OR p_driver_name = '' THEN RETURN; END IF;
  SELECT id INTO found_id FROM public.drivers WHERE name = p_driver_name LIMIT 1;
  IF found_id IS NULL THEN
    INSERT INTO public.drivers (name, license_plate, phone) VALUES (p_driver_name, p_license_plate, p_phone) RETURNING id INTO found_id;
  END IF;
  RETURN QUERY SELECT found_id, p_driver_name;
END;
$function$;

-- Function to get or create location
CREATE OR REPLACE FUNCTION public.get_or_create_location(p_location_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  location_id uuid;
BEGIN
  IF p_location_name IS NULL OR p_location_name = '' THEN RETURN NULL; END IF;
  SELECT id INTO location_id FROM public.locations WHERE name = p_location_name LIMIT 1;
  IF location_id IS NULL THEN
    INSERT INTO public.locations (name) VALUES (p_location_name) RETURNING id INTO location_id;
  END IF;
  RETURN location_id;
END;
$function$;

-- Function to add logistics record with costs
CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs(
  p_project_id uuid, p_project_name text, p_chain_id uuid, p_driver_id uuid, p_driver_name text, 
  p_loading_location text, p_unloading_location text, p_loading_date text, p_loading_weight numeric, 
  p_unloading_weight numeric, p_current_cost numeric, p_license_plate text, p_driver_phone text, 
  p_transport_type text, p_extra_cost numeric, p_driver_payable_cost numeric, p_remarks text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_record_id uuid;
  total_payable_cost numeric;
BEGIN
  INSERT INTO public.logistics_records (
    project_id, project_name, chain_id, driver_id, driver_name, loading_location, unloading_location,
    loading_date, loading_weight, unloading_weight, current_cost,
    license_plate, driver_phone, transport_type, extra_cost, driver_payable_cost, remarks,
    created_by_user_id, auto_number
  ) VALUES (
    p_project_id, p_project_name, p_chain_id, p_driver_id, p_driver_name, p_loading_location, p_unloading_location,
    p_loading_date, p_loading_weight, p_unloading_weight, p_current_cost,
    p_license_plate, p_driver_phone, p_transport_type, p_extra_cost, p_driver_payable_cost, p_remarks,
    'system', generate_auto_number(p_loading_date)
  ) RETURNING id INTO new_record_id;

  IF p_current_cost IS NOT NULL AND p_current_cost > 0 THEN
    INSERT INTO public.logistics_partner_costs (logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate)
    SELECT new_record_id, costs.partner_id, costs.level, costs.base_amount, costs.payable_amount, costs.tax_rate
    FROM public.calculate_partner_costs_v2(p_current_cost, p_project_id, p_chain_id, p_loading_weight, p_unloading_weight) AS costs;
    
    SELECT COALESCE(SUM(lpc.payable_amount), 0) INTO total_payable_cost 
    FROM public.logistics_partner_costs lpc WHERE lpc.logistics_record_id = new_record_id;
    
    UPDATE public.logistics_records SET payable_cost = total_payable_cost WHERE id = new_record_id;
  END IF;
END;
$function$;

-- Function to update logistics record with costs
CREATE OR REPLACE FUNCTION public.update_logistics_record_with_costs(
  p_record_id uuid, p_project_id uuid, p_project_name text, p_chain_id uuid, p_driver_id uuid, 
  p_driver_name text, p_loading_location text, p_unloading_location text, p_loading_date text, 
  p_loading_weight numeric, p_unloading_weight numeric, p_current_cost numeric, p_license_plate text, 
  p_driver_phone text, p_transport_type text, p_extra_cost numeric, p_driver_payable_cost numeric, p_remarks text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_payable_cost numeric;
BEGIN
  DELETE FROM public.logistics_partner_costs WHERE logistics_record_id = p_record_id;
  
  UPDATE public.logistics_records SET
    project_id = p_project_id, project_name = p_project_name, chain_id = p_chain_id, driver_id = p_driver_id, driver_name = p_driver_name,
    loading_location = p_loading_location, unloading_location = p_unloading_location, loading_date = p_loading_date,
    loading_weight = p_loading_weight, unloading_weight = p_unloading_weight, current_cost = p_current_cost,
    license_plate = p_license_plate, driver_phone = p_driver_phone, transport_type = p_transport_type,
    extra_cost = p_extra_cost, driver_payable_cost = p_driver_payable_cost, remarks = p_remarks,
    payable_cost = NULL
  WHERE id = p_record_id;

  IF p_current_cost IS NOT NULL AND p_current_cost > 0 THEN
    INSERT INTO public.logistics_partner_costs (logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate)
    SELECT p_record_id, costs.partner_id, costs.level, costs.base_amount, costs.payable_amount, costs.tax_rate
    FROM public.calculate_partner_costs_v2(p_current_cost, p_project_id, p_chain_id, p_loading_weight, p_unloading_weight) AS costs;
    
    SELECT COALESCE(SUM(lpc.payable_amount), 0) INTO total_payable_cost 
    FROM public.logistics_partner_costs lpc WHERE lpc.logistics_record_id = p_record_id;
    
    UPDATE public.logistics_records SET payable_cost = total_payable_cost WHERE id = p_record_id;
  END IF;
END;
$function$;

-- Create view for logistics records with additional fields
CREATE OR REPLACE VIEW public.logistics_records_view AS
SELECT 
  lr.*,
  pc.chain_name
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id;