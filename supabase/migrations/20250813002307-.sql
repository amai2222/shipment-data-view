-- Create function to check for duplicate logistics records
CREATE OR REPLACE FUNCTION public.check_logistics_record_duplicate(
  p_driver_name text,
  p_license_plate text,
  p_driver_phone text,
  p_loading_location text,
  p_unloading_location text,
  p_loading_date date,
  p_loading_weight numeric,
  p_exclude_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.logistics_records
    WHERE driver_name = p_driver_name
    AND license_plate = p_license_plate
    AND driver_phone = p_driver_phone
    AND loading_location = p_loading_location
    AND unloading_location = p_unloading_location
    AND loading_date::date = p_loading_date
    AND loading_weight = p_loading_weight
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
END;
$$;