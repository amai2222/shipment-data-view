-- Fix function overloading conflicts and type mismatches

-- Drop the problematic overloaded function
DROP FUNCTION IF EXISTS public.get_dashboard_stats_with_billing_types(text, text, uuid);

-- Update the existing function to handle both date and text parameters properly
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_with_billing_types(
    p_start_date date,
    p_end_date date,
    p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH filtered_records AS (
        SELECT 
            lr.*,
            COALESCE(lr.billing_type_id, 1) as billing_type
        FROM logistics_records lr
        WHERE 
            lr.loading_date >= p_start_date
            AND lr.loading_date <= p_end_date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    ),
    overview_stats AS (
        SELECT 
            COUNT(*) as total_records,
            -- 按重量计费的总重量
            COALESCE(SUM(
                CASE 
                    WHEN billing_type = 1 THEN COALESCE(unloading_weight, loading_weight, 0)
                    ELSE 0 
                END
            ), 0) as total_weight,
            -- 按体积计费的总体积
            COALESCE(SUM(
                CASE 
                    WHEN billing_type = 3 THEN COALESCE(loading_weight, 0)
                    ELSE 0 
                END
            ), 0) as total_volume,
            -- 按车次计费的总车次
            COUNT(
                CASE 
                    WHEN billing_type = 2 THEN 1
                    ELSE NULL 
                END
            ) as total_trips,
            COALESCE(SUM(payable_cost), 0) as total_cost,
            -- 实际运输和退货统计
            COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END) as actual_transport_count,
            COUNT(CASE WHEN transport_type = '退货' THEN 1 END) as return_count,
            -- 各计费类型记录数
            COUNT(CASE WHEN billing_type = 1 THEN 1 END) as weight_records_count,
            COUNT(CASE WHEN billing_type = 2 THEN 1 END) as trip_records_count,
            COUNT(CASE WHEN billing_type = 3 THEN 1 END) as volume_records_count
        FROM filtered_records
    ),
    daily_transport_stats AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(date_val, 'YYYY-MM-DD'),
                'actualTransport', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 1 AND transport_type = '实际运输' 
                        THEN COALESCE(unloading_weight, loading_weight, 0)
                        ELSE 0 
                    END
                ), 0),
                'returns', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 1 AND transport_type = '退货' 
                        THEN COALESCE(unloading_weight, loading_weight, 0)
                        ELSE 0 
                    END
                ), 0)
            ) ORDER BY date_val
        ) as data
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) date_val
        LEFT JOIN filtered_records fr ON DATE(fr.loading_date) = DATE(date_val) AND fr.billing_type = 1
        GROUP BY date_val
    ),
    daily_trip_stats AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(date_val, 'YYYY-MM-DD'),
                'actualTransport', COUNT(
                    CASE 
                        WHEN billing_type = 2 AND transport_type = '实际运输' 
                        THEN 1 
                        ELSE NULL 
                    END
                ),
                'returns', COUNT(
                    CASE 
                        WHEN billing_type = 2 AND transport_type = '退货' 
                        THEN 1 
                        ELSE NULL 
                    END
                )
            ) ORDER BY date_val
        ) as data
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) date_val
        LEFT JOIN filtered_records fr ON DATE(fr.loading_date) = DATE(date_val) AND fr.billing_type = 2
        GROUP BY date_val
    ),
    daily_volume_stats AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(date_val, 'YYYY-MM-DD'),
                'actualTransport', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 3 AND transport_type = '实际运输' 
                        THEN COALESCE(loading_weight, 0)
                        ELSE 0 
                    END
                ), 0),
                'returns', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 3 AND transport_type = '退货' 
                        THEN COALESCE(loading_weight, 0)
                        ELSE 0 
                    END
                ), 0)
            ) ORDER BY date_val
        ) as data
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) date_val
        LEFT JOIN filtered_records fr ON DATE(fr.loading_date) = DATE(date_val) AND fr.billing_type = 3
        GROUP BY date_val
    ),
    daily_cost_stats AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(date_val, 'YYYY-MM-DD'),
                'totalCost', COALESCE(SUM(payable_cost), 0)
            ) ORDER BY date_val
        ) as data
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) date_val
        LEFT JOIN filtered_records fr ON DATE(fr.loading_date) = DATE(date_val)
        GROUP BY date_val
    ),
    daily_count_stats AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(date_val, 'YYYY-MM-DD'),
                'count', COUNT(*)
            ) ORDER BY date_val
        ) as data
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) date_val
        LEFT JOIN filtered_records fr ON DATE(fr.loading_date) = DATE(date_val)
        GROUP BY date_val
    )
    SELECT jsonb_build_object(
        'overview', row_to_json(os.*),
        'dailyTransportStats', COALESCE(dts.data, '[]'::jsonb),
        'dailyTripStats', COALESCE(dtrips.data, '[]'::jsonb),
        'dailyVolumeStats', COALESCE(dvs.data, '[]'::jsonb),
        'dailyCostStats', COALESCE(dcs.data, '[]'::jsonb),
        'dailyCountStats', COALESCE(dcnts.data, '[]'::jsonb)
    )
    INTO result
    FROM overview_stats os,
         daily_transport_stats dts,
         daily_trip_stats dtrips,
         daily_volume_stats dvs,
         daily_cost_stats dcs,
         daily_count_stats dcnts;

    RETURN result;
END;
$$;

-- Fix the get_filtered_logistics_records function to return consistent types
DROP FUNCTION IF EXISTS public.get_filtered_logistics_records(uuid, uuid, date, date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_filtered_logistics_records(
    p_project_id uuid DEFAULT NULL,
    p_driver_id uuid DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_limit integer DEFAULT 1000,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_result jsonb;
BEGIN
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
            AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
            AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
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