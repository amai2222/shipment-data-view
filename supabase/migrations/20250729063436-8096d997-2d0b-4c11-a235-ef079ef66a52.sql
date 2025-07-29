-- 修复 get_or_create_driver_with_project 函数中的列名歧义问题
DROP FUNCTION IF EXISTS public.get_or_create_driver_with_project(text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.get_or_create_driver_with_project(p_driver_name text, p_license_plate text, p_phone text, p_project_id uuid)
 RETURNS TABLE(driver_id uuid, driver_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_driver_id uuid;
BEGIN
  IF p_driver_name IS NULL OR p_driver_name = '' THEN RETURN; END IF;
  
  -- Try to find existing driver
  SELECT d.id INTO found_driver_id 
  FROM public.drivers d
  WHERE d.name = p_driver_name 
  LIMIT 1;
  
  -- If not found, create new driver
  IF found_driver_id IS NULL THEN
    INSERT INTO public.drivers (name, license_plate, phone) 
    VALUES (p_driver_name, p_license_plate, p_phone) 
    RETURNING id INTO found_driver_id;
  END IF;
  
  -- Associate driver with project if not already associated
  INSERT INTO public.driver_projects (driver_id, project_id)
  VALUES (found_driver_id, p_project_id)
  ON CONFLICT (driver_id, project_id) DO NOTHING;
  
  RETURN QUERY SELECT found_driver_id, p_driver_name;
END;
$function$;