-- 新建项目看板RPC函数，添加司机应收总额字段
-- 函数名：get_projects_overview_with_driver_receivable
-- 为了便于回滚，不修改现有函数

CREATE OR REPLACE FUNCTION get_projects_overview_with_driver_receivable(
  p_report_date text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_project_ids text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_report_date date;
  v_all_projects_data jsonb := '[]'::jsonb;
  v_global_seven_day_trend jsonb := '[]'::jsonb;
  v_global_driver_report_table jsonb := '[]'::jsonb;
  v_global_summary jsonb := '{}'::jsonb;
BEGIN
  -- 参数处理
  v_report_date := COALESCE(p_report_date::date, CURRENT_DATE);
  
  -- 1. 批量获取所有项目的基本信息
  WITH project_base AS (
    SELECT DISTINCT p.id, p.name, p.partner_name, p.start_date, p.planned_total_tons, p.billing_type_id
    FROM projects p
    WHERE (p_project_id IS NULL OR p.id = p_project_id)
    AND (p_project_ids IS NULL OR p.id = ANY(p_project_ids))
  ),
  
  -- 2. 批量获取所有项目的日报数据（当天）
  daily_reports AS (
    SELECT 
      lr.project_id,
      COUNT(*) AS trip_count,
      COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0) AS total_tonnage,
      COALESCE(SUM(lpc_driver.base_amount), 0) AS driver_receivable,
      COALESCE(SUM(lpc_top.payable_amount), 0) AS partner_payable
    FROM logistics_records lr
    LEFT JOIN logistics_partner_costs lpc_driver 
      ON lr.id = lpc_driver.logistics_record_id AND lpc_driver.level = 1
    LEFT JOIN LATERAL (
      SELECT payable_amount
      FROM logistics_partner_costs
      WHERE logistics_record_id = lr.id
      ORDER BY level DESC
      LIMIT 1
    ) lpc_top ON true
    WHERE lr.loading_date::date = v_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id
  ),
  
  -- 3. 批量获取所有项目的汇总统计（截至报告日期）
  -- 分两步：先聚合，再计算（避免嵌套聚合错误）
  summary_stats_base AS (
    SELECT 
      lr.project_id,
      COUNT(*) AS total_trips,
      SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage,
      SUM(lpc_top.payable_amount) AS total_cost,
      SUM(lpc_driver.base_amount) AS total_driver_receivable
    FROM logistics_records lr
    LEFT JOIN LATERAL (
      SELECT payable_amount
      FROM logistics_partner_costs
      WHERE logistics_record_id = lr.id
      ORDER BY level DESC
      LIMIT 1
    ) lpc_top ON true
    LEFT JOIN logistics_partner_costs lpc_driver 
      ON lr.id = lpc_driver.logistics_record_id AND lpc_driver.level = 1
    WHERE lr.loading_date::date <= v_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id
  ),
  summary_stats AS (
    SELECT 
      project_id,
      total_trips,
      COALESCE(total_tonnage, 0) AS total_tonnage,
      COALESCE(total_cost, 0) AS total_cost,
      COALESCE(total_driver_receivable, 0) AS total_driver_receivable,
      CASE 
        WHEN COALESCE(total_tonnage, 0) > 0 
        THEN COALESCE(total_cost, 0) / total_tonnage
        ELSE 0
      END AS avg_cost
    FROM summary_stats_base
  ),
  
  -- 4. 批量获取7日趋势（所有项目）
  seven_day_trend AS (
    SELECT 
      lr.project_id,
      lr.loading_date::date AS date,
      COUNT(*) AS trips,
      SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS weight,
      SUM(lpc_driver.base_amount) AS receivable
    FROM logistics_records lr
    LEFT JOIN logistics_partner_costs lpc_driver 
      ON lr.id = lpc_driver.logistics_record_id AND lpc_driver.level = 1
    WHERE lr.loading_date::date >= v_report_date - INTERVAL '6 days'
    AND lr.loading_date::date <= v_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id, lr.loading_date::date
  ),
  
  -- 5. 批量获取司机报表数据（所有项目）
  driver_report_base AS (
    SELECT 
      lr.project_id,
      d.name AS driver_name,
      d.license_plate,
      d.phone,
      COUNT(CASE WHEN lr.loading_date::date = v_report_date THEN 1 END) AS daily_trip_count,
      COUNT(*) AS total_trip_count,
      SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage,
      SUM(lpc_driver.base_amount) AS total_driver_receivable,
      SUM(lpc_top.payable_amount) AS total_partner_payable
    FROM logistics_records lr
    JOIN drivers d ON lr.driver_id = d.id
    LEFT JOIN logistics_partner_costs lpc_driver 
      ON lr.id = lpc_driver.logistics_record_id AND lpc_driver.level = 1
    LEFT JOIN LATERAL (
      SELECT payable_amount
      FROM logistics_partner_costs
      WHERE logistics_record_id = lr.id
      ORDER BY level DESC
      LIMIT 1
    ) lpc_top ON true
    WHERE lr.loading_date::date <= v_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id, d.id, d.name, d.license_plate, d.phone
  ),
  
  -- 6. 组合所有数据
  project_data AS (
    SELECT 
      pb.id,
      pb.name,
      pb.partner_name,
      pb.start_date,
      pb.planned_total_tons,
      pb.billing_type_id,
      COALESCE(dr.trip_count, 0) AS daily_trip_count,
      COALESCE(dr.total_tonnage, 0) AS daily_tonnage,
      COALESCE(dr.driver_receivable, 0) AS daily_driver_receivable,
      COALESCE(dr.partner_payable, 0) AS daily_partner_payable,
      COALESCE(ss.total_trips, 0) AS total_trips,
      COALESCE(ss.total_tonnage, 0) AS total_tonnage,
      COALESCE(ss.total_cost, 0) AS total_cost,
      COALESCE(ss.total_driver_receivable, 0) AS total_driver_receivable,
      COALESCE(ss.avg_cost, 0) AS avg_cost,
      COALESCE(json_agg(
        json_build_object(
          'date', std.date,
          'trips', std.trips,
          'weight', std.weight,
          'receivable', std.receivable
        ) ORDER BY std.date
      ) FILTER (WHERE std.date IS NOT NULL), '[]'::json) AS seven_day_trend,
      COALESCE(json_agg(
        json_build_object(
          'driver_name', drb.driver_name,
          'license_plate', drb.license_plate,
          'phone', drb.phone,
          'daily_trip_count', drb.daily_trip_count,
          'total_trip_count', drb.total_trip_count,
          'total_tonnage', drb.total_tonnage,
          'total_driver_receivable', drb.total_driver_receivable,
          'total_partner_payable', drb.total_partner_payable
        ) ORDER BY drb.driver_name
      ) FILTER (WHERE drb.driver_name IS NOT NULL), '[]'::json) AS driver_report_table
    FROM project_base pb
    LEFT JOIN daily_reports dr ON pb.id = dr.project_id
    LEFT JOIN summary_stats ss ON pb.id = ss.project_id
    LEFT JOIN seven_day_trend std ON pb.id = std.project_id
    LEFT JOIN driver_report_base drb ON pb.id = drb.project_id
    GROUP BY pb.id, pb.name, pb.partner_name, pb.start_date, pb.planned_total_tons, pb.billing_type_id,
             dr.trip_count, dr.total_tonnage, dr.driver_receivable, dr.partner_payable,
             ss.total_trips, ss.total_tonnage, ss.total_cost, ss.total_driver_receivable, ss.avg_cost
  )
  
  -- 构建最终结果
  SELECT jsonb_build_object(
    'all_projects_data', COALESCE(json_agg(
      json_build_object(
        'project_details', json_build_array(
          json_build_object(
            'id', id,
            'name', name,
            'partner_name', partner_name,
            'start_date', start_date,
            'planned_total_tons', planned_total_tons,
            'billing_type_id', billing_type_id
          )
        ),
        'daily_report', json_build_object(
          'trip_count', daily_trip_count,
          'total_tonnage', daily_tonnage,
          'driver_receivable', daily_driver_receivable,
          'partner_payable', daily_partner_payable
        ),
        'summary_stats', json_build_object(
          'total_trips', total_trips,
          'total_tonnage', total_tonnage,
          'total_cost', total_cost,
          'total_driver_receivable', total_driver_receivable,
          'avg_cost', avg_cost
        ),
        'seven_day_trend', seven_day_trend,
        'driver_report_table', driver_report_table
      ) ORDER BY name
    ), '[]'::json),
    'global_seven_day_trend', COALESCE(json_agg(
      json_build_object(
        'date', date,
        'trips', SUM(trips),
        'weight', SUM(weight),
        'receivable', SUM(receivable)
      ) ORDER BY date
    ) FILTER (WHERE date IS NOT NULL), '[]'::json),
    'global_driver_report_table', COALESCE(json_agg(
      json_build_object(
        'driver_name', driver_name,
        'license_plate', license_plate,
        'phone', phone,
        'daily_trip_count', SUM(daily_trip_count),
        'total_trip_count', SUM(total_trip_count),
        'total_tonnage', SUM(total_tonnage),
        'total_driver_receivable', SUM(total_driver_receivable),
        'total_partner_payable', SUM(total_partner_payable)
      ) ORDER BY driver_name
    ) FILTER (WHERE driver_name IS NOT NULL), '[]'::json),
    'global_summary', json_build_object(
      'total_projects', COUNT(DISTINCT id),
      'total_receivable', SUM(total_driver_receivable),
      'total_trips', SUM(total_trips)
    )
  )
  INTO v_all_projects_data
  FROM project_data, seven_day_trend, driver_report_base;
  
  RETURN v_all_projects_data;
END;
$$;

-- 验证新函数创建成功
SELECT '新RPC函数 get_projects_overview_with_driver_receivable 创建完成' AS status;

-- 测试新函数（可选）
-- SELECT get_projects_overview_with_driver_receivable('2025-01-15', NULL, NULL);
