-- Fix ambiguous column reference error in get_dashboard_stats_with_billing_types

DROP FUNCTION IF EXISTS public.get_dashboard_stats_with_billing_types(date, date, uuid);

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
    )
    SELECT jsonb_build_object(
        'overview', (
            SELECT jsonb_build_object(
                'totalRecords', COUNT(*),
                'totalWeight', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 1 THEN COALESCE(unloading_weight, loading_weight, 0)
                        ELSE 0 
                    END
                ), 0),
                'totalVolume', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 3 THEN COALESCE(loading_weight, 0)
                        ELSE 0 
                    END
                ), 0),
                'totalTrips', COUNT(
                    CASE 
                        WHEN billing_type = 2 THEN 1
                        ELSE NULL 
                    END
                ),
                'totalCost', COALESCE(SUM(payable_cost), 0),
                'actualTransportCount', COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END),
                'returnCount', COUNT(CASE WHEN transport_type = '退货' THEN 1 END),
                'weightRecordsCount', COUNT(CASE WHEN billing_type = 1 THEN 1 END),
                'tripRecordsCount', COUNT(CASE WHEN billing_type = 2 THEN 1 END),
                'volumeRecordsCount', COUNT(CASE WHEN billing_type = 3 THEN 1 END)
            )
            FROM filtered_records
        ),
        'dailyTransportStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'actualTransport', COALESCE(stats.actual_transport, 0),
                    'returns', COALESCE(stats.returns, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date) as loading_date_only,
                    SUM(
                        CASE 
                            WHEN billing_type = 1 AND transport_type = '实际运输' 
                            THEN COALESCE(unloading_weight, loading_weight, 0)
                            ELSE 0 
                        END
                    ) as actual_transport,
                    SUM(
                        CASE 
                            WHEN billing_type = 1 AND transport_type = '退货' 
                            THEN COALESCE(unloading_weight, loading_weight, 0)
                            ELSE 0 
                        END
                    ) as returns
                FROM filtered_records 
                WHERE billing_type = 1
                GROUP BY DATE(loading_date)
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyTripStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'actualTransport', COALESCE(stats.actual_transport, 0),
                    'returns', COALESCE(stats.returns, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date) as loading_date_only,
                    COUNT(
                        CASE 
                            WHEN billing_type = 2 AND transport_type = '实际运输' 
                            THEN 1 
                            ELSE NULL 
                        END
                    ) as actual_transport,
                    COUNT(
                        CASE 
                            WHEN billing_type = 2 AND transport_type = '退货' 
                            THEN 1 
                            ELSE NULL 
                        END
                    ) as returns
                FROM filtered_records 
                WHERE billing_type = 2
                GROUP BY DATE(loading_date)
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyVolumeStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'actualTransport', COALESCE(stats.actual_transport, 0),
                    'returns', COALESCE(stats.returns, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date) as loading_date_only,
                    SUM(
                        CASE 
                            WHEN billing_type = 3 AND transport_type = '实际运输' 
                            THEN COALESCE(loading_weight, 0)
                            ELSE 0 
                        END
                    ) as actual_transport,
                    SUM(
                        CASE 
                            WHEN billing_type = 3 AND transport_type = '退货' 
                            THEN COALESCE(loading_weight, 0)
                            ELSE 0 
                        END
                    ) as returns
                FROM filtered_records 
                WHERE billing_type = 3
                GROUP BY DATE(loading_date)
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyCostStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'totalCost', COALESCE(stats.total_cost, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date) as loading_date_only,
                    SUM(payable_cost) as total_cost
                FROM filtered_records
                GROUP BY DATE(loading_date)
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyCountStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'count', COALESCE(stats.record_count, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date) as loading_date_only,
                    COUNT(*) as record_count
                FROM filtered_records
                GROUP BY DATE(loading_date)
            ) stats ON DATE(series_date) = stats.loading_date_only
        )
    )
    INTO result;

    RETURN result;
END;
$$;