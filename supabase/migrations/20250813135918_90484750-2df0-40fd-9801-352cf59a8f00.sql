-- 更新update_logistics_record_via_recalc函数，添加billing_type_id参数
CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc(
    p_record_id uuid,
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
AS $$
DECLARE
    driver_payable numeric;
    v_project_code text;
    v_billing_type_id bigint;
BEGIN
    SELECT auto_code INTO v_project_code FROM public.projects WHERE id = p_project_id;
    IF v_project_code IS NULL OR v_project_code = '' THEN
        v_project_code := UPPER(SUBSTRING(p_project_name, 1, 4));
        UPDATE public.projects SET auto_code = v_project_code WHERE id = p_project_id;
    END IF;

    -- Get billing_type_id from chain
    SELECT billing_type_id INTO v_billing_type_id 
    FROM public.partner_chains 
    WHERE id = p_chain_id;
    
    -- Default to 1 if no chain or no billing_type_id
    v_billing_type_id := COALESCE(v_billing_type_id, 1);

    driver_payable := (COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0));
    
    UPDATE public.logistics_records SET
      project_id = p_project_id, 
      project_name = p_project_name, 
      chain_id = p_chain_id,
      billing_type_id = v_billing_type_id,
      driver_id = p_driver_id, 
      driver_name = p_driver_name,
      loading_location = p_loading_location, 
      unloading_location = p_unloading_location, 
      loading_date = p_loading_date,
      unloading_date = p_unloading_date, 
      loading_weight = p_loading_weight, 
      unloading_weight = p_unloading_weight, 
      current_cost = p_current_cost,
      license_plate = p_license_plate, 
      driver_phone = p_driver_phone, 
      transport_type = p_transport_type,
      extra_cost = p_extra_cost, 
      remarks = p_remarks,
      payable_cost = driver_payable
    WHERE id = p_record_id;

    -- 调用已加固的子函数，该函数会正确处理 logistics_partner_costs 的 user_id 插入
    PERFORM public.recalculate_and_update_costs_for_record(p_record_id);
END;
$$;