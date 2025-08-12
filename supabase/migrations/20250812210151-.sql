-- 创建增强的运单详细记录获取函数，支持计费模式信息
CREATE OR REPLACE FUNCTION public.get_filtered_logistics_records_with_billing(
    p_project_id uuid DEFAULT NULL,
    p_driver_id uuid DEFAULT NULL, 
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
    result_json jsonb;
    total_count integer;
BEGIN
    -- 获取总数
    SELECT COUNT(*)
    INTO total_count
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE 
        (p_project_id IS NULL OR lr.project_id = p_project_id)
        AND (p_driver_id IS NULL OR lr.driver_id = p_driver_id)
        AND (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
        AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date);

    -- 获取分页记录
    WITH paginated_records AS (
        SELECT 
            lr.*,
            pc.chain_name,
            COALESCE(pc.billing_type_id, 1) as billing_type_id
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 
            (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND (p_driver_id IS NULL OR lr.driver_id = p_driver_id)
            AND (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
            AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
        ORDER BY lr.loading_date DESC, lr.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', id,
                'auto_number', auto_number,
                'project_id', project_id,
                'project_name', project_name,
                'chain_id', chain_id,
                'loading_date', loading_date,
                'loading_location', loading_location,
                'unloading_location', unloading_location,
                'driver_id', driver_id,
                'driver_name', driver_name,
                'license_plate', license_plate,
                'driver_phone', driver_phone,
                'loading_weight', loading_weight,
                'unloading_date', unloading_date,
                'unloading_weight', unloading_weight,
                'transport_type', transport_type,
                'current_cost', current_cost,
                'extra_cost', extra_cost,
                'payable_cost', payable_cost,
                'remarks', remarks,
                'created_at', created_at,
                'created_by_user_id', created_by_user_id,
                'chain_name', chain_name,
                'billing_type_id', billing_type_id
            )
        ), '[]'::jsonb),
        'total_count', total_count
    )
    INTO result_json
    FROM paginated_records;

    RETURN result_json;
END;
$$;