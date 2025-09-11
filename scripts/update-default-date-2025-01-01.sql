-- 更新数据库函数默认开始日期为2025-01-01
-- 这个脚本将更新所有相关函数的默认日期设置

-- 1. 更新快速首页统计函数
CREATE OR REPLACE FUNCTION public.get_dashboard_quick_stats(
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
    default_start_date date;
    default_end_date date;
BEGIN
    -- 设置默认日期范围：从2025-01-01开始
    default_start_date := COALESCE(p_start_date, '2025-01-01'::date);
    default_end_date := COALESCE(p_end_date, CURRENT_DATE);
    
    WITH filtered_records AS (
        SELECT 
            lr.*,
            COALESCE(lr.billing_type_id, 1) as billing_type
        FROM logistics_records lr
        WHERE 
            lr.loading_date >= default_start_date
            AND lr.loading_date <= default_end_date
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    ),
    overview_stats AS (
        SELECT 
            COUNT(*) as total_records,
            COALESCE(SUM(
                CASE 
                    WHEN billing_type = 1 THEN COALESCE(unloading_weight, loading_weight, 0)
                    ELSE 0 
                END
            ), 0) as total_weight,
            COALESCE(SUM(
                CASE 
                    WHEN billing_type = 3 THEN COALESCE(loading_weight, 0)
                    ELSE 0 
                END
            ), 0) as total_volume,
            COUNT(
                CASE 
                    WHEN billing_type = 2 THEN 1
                    ELSE NULL 
                END
            ) as total_trips,
            COALESCE(SUM(payable_cost), 0) as total_cost,
            COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END) as actual_transport_count,
            COUNT(CASE WHEN transport_type = '退货' THEN 1 END) as return_count
        FROM filtered_records
    ),
    type_stats AS (
        SELECT 
            billing_type,
            COUNT(*) as record_count,
            COALESCE(SUM(
                CASE 
                    WHEN billing_type = 1 THEN COALESCE(unloading_weight, loading_weight, 0)
                    WHEN billing_type = 3 THEN COALESCE(loading_weight, 0)
                    ELSE 0 
                END
            ), 0) as total_quantity
        FROM filtered_records
        GROUP BY billing_type
    )
    SELECT jsonb_build_object(
        'overview', (
            SELECT jsonb_build_object(
                'totalRecords', total_records,
                'totalWeight', total_weight,
                'totalVolume', total_volume,
                'totalTrips', total_trips,
                'totalCost', total_cost,
                'actualTransportCount', actual_transport_count,
                'returnCount', return_count
            )
            FROM overview_stats
        ),
        'totalQuantityByType', (
            SELECT jsonb_object_agg(
                billing_type::text, 
                total_quantity
            )
            FROM type_stats
        ),
        'dateRange', jsonb_build_object(
            'startDate', default_start_date,
            'endDate', default_end_date
        )
    )
    INTO result;

    RETURN result;
END;
$$;

-- 2. 更新原有的看板统计函数（如果存在）
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
    -- 设置默认日期范围：从2025-01-01开始
    IF p_start_date IS NULL OR p_start_date = '' THEN
        p_start_date := '2025-01-01';
    END IF;
    
    IF p_end_date IS NULL OR p_end_date = '' THEN
        p_end_date := CURRENT_DATE::text;
    END IF;

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
        COALESCE(SUM(CASE WHEN billing_type_id = 1 OR billing_type_id IS NULL THEN effective_weight_volume END), 0),
        COALESCE(SUM(CASE WHEN billing_type_id = 3 THEN effective_weight_volume END), 0),
        COUNT(CASE WHEN billing_type_id = 2 THEN 1 END),
        COALESCE(SUM(payable_cost), 0),
        COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END),
        COUNT(CASE WHEN transport_type = '退货' THEN 1 END)
    INTO 
        weight_records_count,
        trip_records_count,
        volume_records_count,
        total_weight,
        total_volume,
        total_trips,
        total_cost,
        actual_transport_count,
        return_count
    FROM filtered_records;

    -- 构建返回结果
    result_json := jsonb_build_object(
        'overview', jsonb_build_object(
            'totalRecords', weight_records_count + trip_records_count + volume_records_count,
            'totalWeight', total_weight,
            'totalVolume', total_volume,
            'totalTrips', total_trips,
            'totalCost', total_cost,
            'actualTransportCount', actual_transport_count,
            'returnCount', return_count
        ),
        'totalQuantityByType', jsonb_build_object(
            '1', total_weight,
            '2', total_trips,
            '3', total_volume
        ),
        'daily_stats_by_type', jsonb_build_object(
            '1', jsonb_build_object('stats', '[]'::jsonb, 'totalActual', 0, 'totalReturns', 0),
            '2', jsonb_build_object('stats', '[]'::jsonb, 'totalActual', 0, 'totalReturns', 0),
            '3', jsonb_build_object('stats', '[]'::jsonb, 'totalActual', 0, 'totalReturns', 0)
        ),
        'dailyCostStats', '[]'::jsonb,
        'dailyCountStats', '[]'::jsonb
    );

    RETURN result_json;
END;
$$;

-- 为函数添加注释
COMMENT ON FUNCTION public.get_dashboard_quick_stats(date, date, uuid) IS '快速获取首页统计数据，默认从2025-01-01开始查询，性能优化版本';
COMMENT ON FUNCTION public.get_dashboard_stats_with_billing_types(text, text, uuid) IS '获取看板统计数据，默认从2025-01-01开始查询，支持按计费模式分类统计';

-- 测试函数（可选）
-- SELECT public.get_dashboard_quick_stats();
-- SELECT public.get_dashboard_stats_with_billing_types('2025-01-01', '2025-12-31');
