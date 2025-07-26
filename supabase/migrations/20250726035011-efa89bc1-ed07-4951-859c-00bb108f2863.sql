-- Drop the existing view and recreate it correctly
DROP VIEW IF EXISTS public.logistics_records_view;

-- Create the view properly with all needed fields
CREATE VIEW public.logistics_records_view AS
SELECT 
  lr.id,
  lr.auto_number,
  lr.project_id,
  lr.project_name,
  lr.chain_id,
  lr.driver_id,
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
  lr.driver_payable_cost,
  lr.license_plate,
  lr.driver_phone,
  lr.transport_type,
  lr.remarks,
  lr.created_at,
  lr.created_by_user_id,
  pc.chain_name
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id;