-- 优化项目看板RPC函数
-- 问题：原函数使用FOR LOOP，对每个项目执行4-5次查询
-- 解决：使用批量查询和集合操作，一次性获取所有数据

-- ============================================
-- 优化版本：批量查询替代循环
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_projects_overview_data_optimized(
  p_report_date date, 
  p_project_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- 使用单次查询获取所有数据，避免循环
  WITH 
  -- 1. 获取项目基础信息
  project_base AS (
    SELECT 
      p.id,
      p.name,
      p.planned_total_tons,
      COALESCE(pc.billing_type_id, 1) AS billing_type_id,
      COALESCE(pt.name, '未知合作方') AS partner_name,
      COALESCE(min_lr.start_date, CURRENT_DATE) AS start_date
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT billing_type_id 
      FROM partner_chains 
      WHERE project_id = p.id 
      LIMIT 1
    ) pc ON true
    LEFT JOIN LATERAL (
      SELECT pt.name
      FROM project_partners pp
      JOIN partners pt ON pp.partner_id = pt.id
      WHERE pp.project_id = p.id
      ORDER BY pp.level DESC
      LIMIT 1
    ) pt ON true
    LEFT JOIN LATERAL (
      SELECT MIN(loading_date)::date AS start_date
      FROM logistics_records
      WHERE project_id = p.id
    ) min_lr ON true
    WHERE p_project_ids IS NULL OR p.id = ANY(p_project_ids)
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
    WHERE lr.loading_date::date = p_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id
  ),
  
  -- 3. 批量获取所有项目的汇总统计（截至报告日期）
  summary_stats AS (
    SELECT 
      lr.project_id,
      COUNT(*) AS total_trips,
      COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0) AS total_tonnage,
      COALESCE(SUM(lpc_top.payable_amount), 0) AS total_cost,
      CASE 
        WHEN SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) > 0 
        THEN SUM(lpc_top.payable_amount) / SUM(COALESCE(lr.unloading_weight, lr.loading_weight))
        ELSE 0
      END AS avg_cost
    FROM logistics_records lr
    LEFT JOIN LATERAL (
      SELECT payable_amount
      FROM logistics_partner_costs
      WHERE logistics_record_id = lr.id
      ORDER BY level DESC
      LIMIT 1
    ) lpc_top ON true
    WHERE lr.loading_date::date <= p_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id
  ),
  
  -- 4. 批量获取7日趋势（所有项目）
  seven_day_trend AS (
    SELECT 
      lr.project_id,
      TO_CHAR(lr.loading_date::date, 'MM-DD') AS date,
      COALESCE(SUM(lpc.base_amount), 0) AS receivable
    FROM logistics_records lr
    LEFT JOIN logistics_partner_costs lpc 
      ON lr.id = lpc.logistics_record_id AND lpc.level = 1
    WHERE lr.loading_date::date BETWEEN p_report_date - INTERVAL '6 days' AND p_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id, lr.loading_date::date
  ),
  
  -- 5. 批量获取司机工作量（当天）
  driver_reports AS (
    SELECT 
      lr.project_id,
      d.name AS driver_name,
      COUNT(lr.id) AS trip_count,
      SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage,
      SUM(lpc.base_amount) AS total_driver_receivable
    FROM logistics_records lr
    JOIN drivers d ON lr.driver_id = d.id
    LEFT JOIN logistics_partner_costs lpc 
      ON lr.id = lpc.logistics_record_id AND lpc.level = 1
    WHERE lr.loading_date::date = p_report_date
    AND (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
    GROUP BY lr.project_id, d.name
  ),
  
  -- 6. 组装每个项目的数据
  projects_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'project_details', jsonb_build_object(
          'id', pb.id,
          'name', pb.name,
          'partner_name', pb.partner_name,
          'start_date', pb.start_date,
          'planned_total_tons', COALESCE(pb.planned_total_tons, 0),
          'billing_type_id', pb.billing_type_id
        ),
        'daily_report', COALESCE(
          jsonb_build_object(
            'trip_count', dr.trip_count,
            'total_tonnage', dr.total_tonnage,
            'driver_receivable', dr.driver_receivable,
            'partner_payable', dr.partner_payable
          ),
          '{"trip_count":0,"total_tonnage":0,"driver_receivable":0,"partner_payable":0}'::jsonb
        ),
        'summary_stats', COALESCE(
          jsonb_build_object(
            'total_trips', ss.total_trips,
            'total_tonnage', ss.total_tonnage,
            'total_cost', ss.total_cost,
            'avg_cost', ss.avg_cost
          ),
          '{"total_trips":0,"total_tonnage":0,"total_cost":0,"avg_cost":0}'::jsonb
        ),
        'seven_day_trend', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object('date', sdt.date, 'receivable', sdt.receivable)
            ORDER BY sdt.date
          )
          FROM seven_day_trend sdt
          WHERE sdt.project_id = pb.id),
          '[]'::jsonb
        ),
        'driver_report_table', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'driver_name', drep.driver_name,
              'trip_count', drep.trip_count,
              'total_tonnage', drep.total_tonnage,
              'total_driver_receivable', drep.total_driver_receivable
            )
            ORDER BY drep.driver_name
          )
          FROM driver_reports drep
          WHERE drep.project_id = pb.id),
          '[]'::jsonb
        )
      )
    ) AS all_projects_data
    FROM project_base pb
    LEFT JOIN daily_reports dr ON pb.id = dr.project_id
    LEFT JOIN summary_stats ss ON pb.id = ss.project_id
  ),
  
  -- 7. 全局7日趋势
  global_trend AS (
    SELECT jsonb_agg(
      jsonb_build_object('date', ds.date, 'receivable', COALESCE(trend_sum.receivable, 0))
      ORDER BY ds.date
    ) AS global_seven_day_trend
    FROM (
      SELECT TO_CHAR(generate_series(
        p_report_date - INTERVAL '6 days', 
        p_report_date, 
        '1 day'::interval
      )::date, 'MM-DD') AS date
    ) ds
    LEFT JOIN (
      SELECT date, SUM(receivable) AS receivable
      FROM seven_day_trend
      GROUP BY date
    ) trend_sum ON ds.date = trend_sum.date
  ),
  
  -- 8. 全局司机报表
  global_drivers AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'driver_name', driver_name,
        'trip_count', SUM(trip_count),
        'total_tonnage', SUM(total_tonnage),
        'total_driver_receivable', SUM(total_driver_receivable)
      )
      ORDER BY SUM(total_driver_receivable) DESC
    ) AS global_driver_report_table
    FROM driver_reports
    GROUP BY driver_name
  ),
  
  -- 9. 全局汇总
  global_summary_data AS (
    SELECT jsonb_build_object(
      'total_projects', COUNT(DISTINCT pb.id),
      'total_receivable', COALESCE(SUM(ss.total_cost), 0),
      'total_trips', COALESCE(SUM(ss.total_trips), 0)
    ) AS global_summary
    FROM project_base pb
    LEFT JOIN summary_stats ss ON pb.id = ss.project_id
  )
  
  -- 10. 组装最终结果
  SELECT jsonb_build_object(
    'all_projects_data', COALESCE(pd.all_projects_data, '[]'::jsonb),
    'global_seven_day_trend', COALESCE(gt.global_seven_day_trend, '[]'::jsonb),
    'global_driver_report_table', COALESCE(gd.global_driver_report_table, '[]'::jsonb),
    'global_summary', gs.global_summary
  )
  INTO v_result
  FROM projects_data pd, global_trend gt, global_drivers gd, global_summary_data gs;
  
  RETURN v_result;
END;
$function$;

-- ============================================
-- 更新主函数使用优化版本
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_projects_overview_data(
  p_report_date date, 
  p_project_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  -- 调用优化版本
  RETURN public.get_all_projects_overview_data_optimized(p_report_date, p_project_ids);
END;
$function$;

-- ============================================
-- 性能对比说明
-- ============================================

COMMENT ON FUNCTION public.get_all_projects_overview_data_optimized IS 
'优化版项目看板数据函数
性能优化：
- 使用CTE批量查询替代FOR LOOP
- 减少查询次数从 N*4 到 8次固定查询
- 20个项目：从80次查询 → 8次查询
- 预计性能提升：5-10倍';

-- ============================================
-- 验证优化效果
-- ============================================

-- 测试查询（开发环境）
-- EXPLAIN ANALYZE SELECT get_all_projects_overview_data(CURRENT_DATE, NULL);

