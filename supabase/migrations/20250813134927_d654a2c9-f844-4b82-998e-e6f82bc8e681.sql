-- Update the get_logistics_summary_and_records function to include billing_type_id
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset integer;
    v_result jsonb;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_records AS (
        SELECT lr.*, 
               COALESCE(pc.billing_type_id, 1) as billing_type_id,
               pc.chain_name
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%') AND
            (p_license_plate IS NULL OR p_license_plate = '' OR lr.license_plate ILIKE '%' || p_license_plate || '%') AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR lr.driver_phone ILIKE '%' || p_driver_phone || '%')
    )
    SELECT jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'totalLoadingWeight', COALESCE(SUM(loading_weight), 0),
                'totalUnloadingWeight', COALESCE(SUM(unloading_weight), 0),
                'totalCurrentCost', COALESCE(SUM(current_cost), 0),
                'totalExtraCost', COALESCE(SUM(extra_cost), 0),
                'totalDriverPayableCost', COALESCE(SUM(payable_cost), 0),
                'actualCount', COUNT(*) FILTER (WHERE transport_type = '实际运输'),
                'returnCount', COUNT(*) FILTER (WHERE transport_type = '退货')
            )
            FROM filtered_records
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(fr.* ORDER BY fr.loading_date DESC, fr.created_at DESC), '[]'::jsonb)
            FROM (
                SELECT *
                FROM filtered_records
                ORDER BY loading_date DESC, created_at DESC
                LIMIT p_page_size
                OFFSET v_offset
            ) fr
        ),
        'count', (SELECT COUNT(*) FROM filtered_records)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;