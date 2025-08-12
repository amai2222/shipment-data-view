-- 创建增强的看板统计函数，支持按计费模式分类统计
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_with_billing_types(
    p_start_date text,
    p_end_date text,
    p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result_json jsonb;
    weight_records_count int := 0;
    trip_records_count int := 0;
    volume_records_count int := 0;
    total_weight numeric := 0;
    total_volume numeric := 0;
    total_trips int := 0;
    total_cost numeric := 0;
    actual_transport_count int := 0;
    return_count int := 0;
    daily_weight_stats jsonb;
    daily_trip_stats jsonb;
    daily_volume_stats jsonb;
    daily_cost_stats jsonb;
    daily_count_stats jsonb;
BEGIN
    -- 获取基础统计数据
    WITH filtered_records AS (
        SELECT 
            lr.*,
            COALESCE(pc.billing_type_id, 1) as billing_type_id,
            CASE 
                WHEN COALESCE(pc.billing_type_id, 1) = 1 THEN COALESCE(lr.unloading_weight, lr.loading_weight, 0)
                WHEN COALESCE(pc.billing_type_id, 1) = 3 THEN COALESCE(lr.loading_weight, 0)
                ELSE 0
            END as effective_weight_volume
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 
            lr.loading_date::date >= p_start_date::date
            AND lr.loading_date::date <= p_end_date::date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    )
    SELECT 
        COUNT(CASE WHEN billing_type_id = 1 OR billing_type_id IS NULL THEN 1 END),
        COUNT(CASE WHEN billing_type_id = 2 THEN 1 END),
        COUNT(CASE WHEN billing_type_id = 3 THEN 1 END),
        SUM(CASE WHEN billing_type_id = 1 OR billing_type_id IS NULL THEN effective_weight_volume ELSE 0 END),
        SUM(CASE WHEN billing_type_id = 3 THEN effective_weight_volume ELSE 0 END),
        COUNT(CASE WHEN billing_type_id = 2 THEN 1 END),
        SUM(COALESCE(payable_cost, 0)),
        COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END),
        COUNT(CASE WHEN transport_type = '退货' THEN 1 END)
    INTO 
        weight_records_count, trip_records_count, volume_records_count,
        total_weight, total_volume, total_trips, total_cost,
        actual_transport_count, return_count
    FROM filtered_records;

    -- 获取每日重量统计
    WITH daily_weight_data AS (
        SELECT 
            lr.loading_date::date as date,
            SUM(CASE WHEN lr.transport_type = '实际运输' AND (COALESCE(pc.billing_type_id, 1) = 1) 
                THEN COALESCE(lr.unloading_weight, lr.loading_weight, 0) ELSE 0 END) as actualTransport,
            SUM(CASE WHEN lr.transport_type = '退货' AND (COALESCE(pc.billing_type_id, 1) = 1)
                THEN COALESCE(lr.unloading_weight, lr.loading_weight, 0) ELSE 0 END) as returns
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 
            lr.loading_date::date >= p_start_date::date
            AND lr.loading_date::date <= p_end_date::date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND (COALESCE(pc.billing_type_id, 1) = 1)
        GROUP BY lr.loading_date::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', date, 'actualTransport', actualTransport, 'returns', returns)
        ORDER BY date
    ), '[]'::jsonb)
    INTO daily_weight_stats
    FROM daily_weight_data;

    -- 获取每日车次统计
    WITH daily_trip_data AS (
        SELECT 
            lr.loading_date::date as date,
            COUNT(CASE WHEN lr.transport_type = '实际运输' THEN 1 END) as actualTransport,
            COUNT(CASE WHEN lr.transport_type = '退货' THEN 1 END) as returns
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 
            lr.loading_date::date >= p_start_date::date
            AND lr.loading_date::date <= p_end_date::date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND COALESCE(pc.billing_type_id, 1) = 2
        GROUP BY lr.loading_date::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', date, 'actualTransport', actualTransport, 'returns', returns)
        ORDER BY date
    ), '[]'::jsonb)
    INTO daily_trip_stats
    FROM daily_trip_data;

    -- 获取每日体积统计
    WITH daily_volume_data AS (
        SELECT 
            lr.loading_date::date as date,
            SUM(CASE WHEN lr.transport_type = '实际运输' THEN COALESCE(lr.loading_weight, 0) ELSE 0 END) as actualTransport,
            SUM(CASE WHEN lr.transport_type = '退货' THEN COALESCE(lr.loading_weight, 0) ELSE 0 END) as returns
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 
            lr.loading_date::date >= p_start_date::date
            AND lr.loading_date::date <= p_end_date::date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND COALESCE(pc.billing_type_id, 1) = 3
        GROUP BY lr.loading_date::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', date, 'actualTransport', actualTransport, 'returns', returns)
        ORDER BY date
    ), '[]'::jsonb)
    INTO daily_volume_stats
    FROM daily_volume_data;

    -- 获取每日费用统计（所有计费模式）
    WITH daily_cost_data AS (
        SELECT 
            lr.loading_date::date as date,
            SUM(COALESCE(lr.payable_cost, 0)) as totalCost
        FROM public.logistics_records lr
        WHERE 
            lr.loading_date::date >= p_start_date::date
            AND lr.loading_date::date <= p_end_date::date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
        GROUP BY lr.loading_date::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', date, 'totalCost', totalCost)
        ORDER BY date
    ), '[]'::jsonb)
    INTO daily_cost_stats
    FROM daily_cost_data;

    -- 获取每日总运输次数统计（所有计费模式）
    WITH daily_count_data AS (
        SELECT 
            lr.loading_date::date as date,
            COUNT(*) as count
        FROM public.logistics_records lr
        WHERE 
            lr.loading_date::date >= p_start_date::date
            AND lr.loading_date::date <= p_end_date::date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
        GROUP BY lr.loading_date::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', date, 'count', count)
        ORDER BY date
    ), '[]'::jsonb)
    INTO daily_count_stats
    FROM daily_count_data;

    -- 构建返回结果
    SELECT jsonb_build_object(
        'overview', jsonb_build_object(
            'totalRecords', weight_records_count + trip_records_count + volume_records_count,
            'totalWeight', COALESCE(total_weight, 0),
            'totalVolume', COALESCE(total_volume, 0),
            'totalTrips', COALESCE(total_trips, 0),
            'totalCost', COALESCE(total_cost, 0),
            'actualTransportCount', actual_transport_count,
            'returnCount', return_count,
            'weightRecordsCount', weight_records_count,
            'tripRecordsCount', trip_records_count,
            'volumeRecordsCount', volume_records_count
        ),
        'dailyTransportStats', daily_weight_stats,
        'dailyTripStats', daily_trip_stats,
        'dailyVolumeStats', daily_volume_stats,
        'dailyCostStats', daily_cost_stats,
        'dailyCountStats', daily_count_stats
    ) INTO result_json;

    RETURN result_json;
END;
$$;