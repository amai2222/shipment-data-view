-- Create missing RPC functions for pagination and batch recalculation

-- Function for paginated logistics records with search
CREATE OR REPLACE FUNCTION public.get_paginated_logistics_records_with_filters(
  p_page_size integer,
  p_offset integer,
  p_start_date text DEFAULT NULL::text,
  p_end_date text DEFAULT NULL::text,
  p_search_query text DEFAULT NULL::text,
  p_project_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
    v_total_count integer;
    search_query_like text;
BEGIN
    -- Prepare search query for LIKE operations
    search_query_like := '%' || COALESCE(p_search_query, '') || '%';

    -- Count total records matching filters
    SELECT COUNT(*)
    INTO v_total_count
    FROM public.logistics_records_view v
    WHERE
        (p_start_date IS NULL OR v.loading_date >= p_start_date) AND
        (p_end_date IS NULL OR v.loading_date <= p_end_date) AND
        (p_project_id IS NULL OR v.project_id = p_project_id) AND
        (p_search_query IS NULL OR p_search_query = '' OR (
            v.auto_number ILIKE search_query_like OR
            v.project_name ILIKE search_query_like OR
            v.driver_name ILIKE search_query_like OR
            v.loading_location ILIKE search_query_like OR
            v.unloading_location ILIKE search_query_like
        ));

    -- Get paginated records
    SELECT jsonb_build_object(
        'total_count', v_total_count,
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
            FROM (
                SELECT *
                FROM public.logistics_records_view v
                WHERE
                    (p_start_date IS NULL OR v.loading_date >= p_start_date) AND
                    (p_end_date IS NULL OR v.loading_date <= p_end_date) AND
                    (p_project_id IS NULL OR v.project_id = p_project_id) AND
                    (p_search_query IS NULL OR p_search_query = '' OR (
                        v.auto_number ILIKE search_query_like OR
                        v.project_name ILIKE search_query_like OR
                        v.driver_name ILIKE search_query_like OR
                        v.loading_location ILIKE search_query_like OR
                        v.unloading_location ILIKE search_query_like
                    ))
                ORDER BY v.created_at DESC
                LIMIT p_page_size
                OFFSET p_offset
            ) t
        )
    )
    INTO result_json;

    RETURN result_json;
END;
$function$;

-- Function for batch recalculating partner costs
CREATE OR REPLACE FUNCTION public.batch_recalculate_partner_costs(
  p_record_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    record_id uuid;
BEGIN
    -- Loop through each record ID and recalculate costs
    FOREACH record_id IN ARRAY p_record_ids
    LOOP
        -- Use the existing recalculation function
        PERFORM public.recalculate_and_update_costs_for_record(record_id);
    END LOOP;
END;
$function$;

-- Update the get_or_create_driver function to include project association
CREATE OR REPLACE FUNCTION public.get_or_create_driver_with_project(
  p_driver_name text, 
  p_license_plate text, 
  p_phone text,
  p_project_id uuid
)
RETURNS TABLE(driver_id uuid, driver_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  found_id uuid;
BEGIN
  IF p_driver_name IS NULL OR p_driver_name = '' THEN RETURN; END IF;
  
  -- Try to find existing driver
  SELECT id INTO found_id 
  FROM public.drivers 
  WHERE name = p_driver_name 
  LIMIT 1;
  
  -- If not found, create new driver
  IF found_id IS NULL THEN
    INSERT INTO public.drivers (name, license_plate, phone) 
    VALUES (p_driver_name, p_license_plate, p_phone) 
    RETURNING id INTO found_id;
  END IF;
  
  -- Associate driver with project if not already associated
  INSERT INTO public.driver_projects (driver_id, project_id)
  VALUES (found_id, p_project_id)
  ON CONFLICT (driver_id, project_id) DO NOTHING;
  
  RETURN QUERY SELECT found_id, p_driver_name;
END;
$function$;

-- Update the get_or_create_location function to include project association
CREATE OR REPLACE FUNCTION public.get_or_create_location_with_project(
  p_location_name text,
  p_project_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  location_id uuid;
BEGIN
  IF p_location_name IS NULL OR p_location_name = '' THEN RETURN NULL; END IF;
  
  -- Try to find existing location
  SELECT id INTO location_id 
  FROM public.locations 
  WHERE name = p_location_name 
  LIMIT 1;
  
  -- If not found, create new location
  IF location_id IS NULL THEN
    INSERT INTO public.locations (name) 
    VALUES (p_location_name) 
    RETURNING id INTO location_id;
  END IF;
  
  -- Associate location with project if not already associated
  INSERT INTO public.location_projects (location_id, project_id)
  VALUES (location_id, p_project_id)
  ON CONFLICT (location_id, project_id) DO NOTHING;
  
  RETURN location_id;
END;
$function$;

-- Function to get drivers with license plates for a project
CREATE OR REPLACE FUNCTION public.get_project_drivers_with_details(p_project_id uuid)
RETURNS TABLE(
  driver_id uuid,
  driver_name text,
  license_plate text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as driver_id,
    d.name as driver_name,
    d.license_plate,
    d.phone
  FROM public.drivers d
  JOIN public.driver_projects dp ON d.id = dp.driver_id
  WHERE dp.project_id = p_project_id
  ORDER BY d.name;
END;
$function$;