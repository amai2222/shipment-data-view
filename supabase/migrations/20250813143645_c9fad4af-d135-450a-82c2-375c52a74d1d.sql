-- Clean up all overloaded functions to resolve conflicts

-- Remove all versions of get_filtered_logistics_records
DROP FUNCTION IF EXISTS public.get_filtered_logistics_records(uuid, uuid, date, date, integer, integer);
DROP FUNCTION IF EXISTS public.get_filtered_logistics_records(uuid, uuid, text, text, integer, integer);

-- Create a single clean version that handles both date and text parameters
CREATE OR REPLACE FUNCTION public.get_filtered_logistics_records_fixed(
    p_project_id uuid DEFAULT NULL,
    p_driver_id uuid DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_limit integer DEFAULT 1000,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_result jsonb;
    v_start_date date;
    v_end_date date;
BEGIN
    -- Convert text dates to date type safely
    v_start_date := CASE 
        WHEN p_start_date IS NOT NULL AND p_start_date != '' 
        THEN p_start_date::date 
        ELSE NULL 
    END;
    
    v_end_date := CASE 
        WHEN p_end_date IS NOT NULL AND p_end_date != '' 
        THEN p_end_date::date 
        ELSE NULL 
    END;

    WITH filtered_records AS (
        SELECT 
            lr.id::text as id,
            lr.auto_number,
            lr.project_name,
            lr.driver_name,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.unloading_date,
            lr.loading_weight,
            lr.unloading_weight,
            lr.transport_type,
            lr.current_cost,
            lr.extra_cost,
            lr.payable_cost,
            lr.license_plate,
            lr.driver_phone,
            lr.remarks,
            COALESCE(lr.billing_type_id, 1) as billing_type_id,
            pc.chain_name
        FROM logistics_records lr
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE 
            (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND (p_driver_id IS NULL OR lr.driver_id = p_driver_id)
            AND (v_start_date IS NULL OR lr.loading_date::date >= v_start_date)
            AND (v_end_date IS NULL OR lr.loading_date::date <= v_end_date)
        ORDER BY lr.loading_date DESC, lr.created_at DESC
    ),
    paginated_records AS (
        SELECT *
        FROM filtered_records
        LIMIT p_limit
        OFFSET p_offset
    ),
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_records
    )
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(pr.* ORDER BY pr.loading_date DESC, pr.auto_number DESC), '[]'::jsonb),
        'totalCount', (SELECT count FROM total_count)
    )
    INTO v_result
    FROM paginated_records pr, total_count;

    RETURN v_result;
END;
$$;