-- Fix the date comparison in the get_paginated_logistics_records function
CREATE OR REPLACE FUNCTION public.get_paginated_logistics_records(
    p_page_size integer, 
    p_offset integer, 
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_search_query text DEFAULT NULL::text
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
        (p_start_date IS NULL OR v.loading_date >= p_start_date::timestamp with time zone) AND
        (p_end_date IS NULL OR v.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone) AND
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
                    (p_start_date IS NULL OR v.loading_date >= p_start_date::timestamp with time zone) AND
                    (p_end_date IS NULL OR v.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone) AND
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

-- Also fix the get_paginated_logistics_records_with_filters function
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
        (p_start_date IS NULL OR v.loading_date >= p_start_date::timestamp with time zone) AND
        (p_end_date IS NULL OR v.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone) AND
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
                    (p_start_date IS NULL OR v.loading_date >= p_start_date::timestamp with time zone) AND
                    (p_end_date IS NULL OR v.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone) AND
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