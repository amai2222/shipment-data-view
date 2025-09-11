-- 优化首页性能：创建轻量级的快速统计函数
-- 这个函数专门用于首页快速加载，避免复杂的日期序列生成

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
    -- 设置默认日期范围：最近30天
    default_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
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
    -- 简化的按类型统计，避免复杂的日期序列
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

-- 创建今日统计的快速函数
CREATE OR REPLACE FUNCTION public.get_today_stats()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
    today_date date := CURRENT_DATE;
BEGIN
    WITH today_records AS (
        SELECT 
            lr.*,
            COALESCE(lr.billing_type_id, 1) as billing_type
        FROM logistics_records lr
        WHERE DATE(lr.loading_date) = today_date
    )
    SELECT jsonb_build_object(
        'todayRecords', COUNT(*),
        'todayWeight', COALESCE(SUM(
            CASE 
                WHEN billing_type = 1 THEN COALESCE(unloading_weight, loading_weight, 0)
                ELSE 0 
            END
        ), 0),
        'todayCost', COALESCE(SUM(payable_cost), 0),
        'activeProjects', (
            SELECT COUNT(DISTINCT project_id) 
            FROM today_records
        )
    )
    INTO result
    FROM today_records;

    RETURN result;
END;
$$;

-- 创建项目统计的快速函数
CREATE OR REPLACE FUNCTION public.get_project_quick_stats()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'activeProjects', (
            SELECT COUNT(*) 
            FROM projects 
            WHERE project_status = '进行中'
        ),
        'pendingPayments', (
            SELECT COUNT(*) 
            FROM payment_requests 
            WHERE status = 'Pending'
        )
    )
    INTO result;

    RETURN result;
END;
$$;

-- 为这些函数添加注释
COMMENT ON FUNCTION public.get_dashboard_quick_stats(date, date, uuid) IS '快速获取首页统计数据，默认查询最近30天数据，性能优化版本';
COMMENT ON FUNCTION public.get_today_stats() IS '获取今日统计数据，用于移动端首页快速加载';
COMMENT ON FUNCTION public.get_project_quick_stats() IS '获取项目相关统计数据，包括活跃项目数和待处理付款数';
