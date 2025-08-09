-- migration_file_unified_dashboard_function_final.sql
-- 备注: 此为最终修复版，优化了主函数对首次加载（传入 project_id 为 null）的处理逻辑。

-- 辅助函数1: 获取项目总览统计 (无需修改)
CREATE OR REPLACE FUNCTION get_project_overall_stats(p_project_id UUID)
RETURNS JSON
LANGUAGE sql AS $$
  -- (此函数代码无需修改)
  WITH ProjectCosts AS (
    SELECT
      lr.id, lr.project_id, lpc.payable_amount
    FROM public.logistics_records lr
    JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
    WHERE lr.project_id = p_project_id
      AND lpc.level = (SELECT MAX(sub.level) FROM public.logistics_partner_costs sub WHERE sub.logistics_record_id = lpc.logistics_record_id)
  )
  SELECT json_build_object(
      'total_trips', (SELECT COUNT(*) FROM public.logistics_records WHERE project_id = p_project_id),
      'total_tonnage', (SELECT COALESCE(SUM(COALESCE(unloading_weight, loading_weight)), 0) FROM public.logistics_records WHERE project_id = p_project_id),
      'total_cost', (SELECT COALESCE(SUM(payable_amount), 0) FROM ProjectCosts),
      'avg_cost', (SELECT COALESCE(SUM(payable_amount), 0) / NULLIF(SUM(COALESCE(unloading_weight, loading_weight)), 0) FROM public.logistics_records lr LEFT JOIN ProjectCosts pc ON lr.id = pc.id WHERE lr.project_id = p_project_id)
  )
$$;

-- 辅助函数2: 获取今日日报 (无需修改)
CREATE OR REPLACE FUNCTION get_project_daily_report(p_project_id UUID, p_report_date DATE)
RETURNS JSON
LANGUAGE sql AS $$
  -- (此函数代码无需修改)
  WITH DailyTopPartnerCosts AS (
    SELECT lpc.logistics_record_id, lpc.payable_amount
    FROM public.logistics_partner_costs lpc
    WHERE lpc.level = (SELECT MAX(sub.level) FROM public.logistics_partner_costs sub WHERE sub.logistics_record_id = lpc.logistics_record_id)
  ), DailyRecords AS (
    SELECT lr.id, COALESCE(lr.unloading_weight, lr.loading_weight) AS tonnage, lr.driver_payable_cost, dtpc.payable_amount AS partner_payable
    FROM public.logistics_records lr LEFT JOIN DailyTopPartnerCosts dtpc ON lr.id = dtpc.logistics_record_id
    WHERE lr.project_id = p_project_id AND lr.loading_date = p_report_date
  )
  SELECT json_build_object('total_tonnage', COALESCE(SUM(tonnage), 0), 'driver_receivable', COALESCE(SUM(driver_payable_cost), 0), 'partner_payable', COALESCE(SUM(partner_payable), 0))
  FROM DailyRecords;
$$;

-- 辅助函数3: 获取7日趋势 (无需修改)
CREATE OR REPLACE FUNCTION get_project_7_day_trend(p_project_id UUID)
RETURNS JSON
LANGUAGE plpgsql AS $$
  -- (此函数代码无需修改)
DECLARE
    v_start_date DATE := CURRENT_DATE - INTERVAL '6 days'; v_end_date DATE := CURRENT_DATE;
BEGIN
    RETURN (
        WITH date_series AS (SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::date AS report_date)
        SELECT json_agg(json_build_object('date', TO_CHAR(ds.report_date, 'MM-DD'), 'trips', COALESCE(daily_data.trips, 0), 'weight', COALESCE(daily_data.total_weight, 0), 'receivable', COALESCE(daily_data.total_receivable, 0)) ORDER BY ds.report_date)
        FROM date_series ds
        LEFT JOIN (
            SELECT lr.loading_date, COUNT(lr.id) AS trips, SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_weight, SUM(lpc.payable_amount) AS total_receivable
            FROM public.logistics_records lr JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
            WHERE lr.project_id = p_project_id AND lr.loading_date BETWEEN v_start_date AND v_end_date AND lpc.level = (SELECT MAX(sub.level) FROM public.logistics_partner_costs sub WHERE sub.logistics_record_id = lpc.logistics_record_id)
            GROUP BY lr.loading_date
        ) AS daily_data ON ds.report_date = daily_data.loading_date
    );
END;
$$;


-- ★★★ 主函数: get_project_dashboard_data (核心修改) ★★★
CREATE OR REPLACE FUNCTION get_project_dashboard_data(
    p_selected_project_id UUID,
    p_report_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_recent_projects JSON;
    v_daily_report JSON;
    v_seven_day_trend JSON;
    v_overall_stats JSON;
BEGIN
    -- 任务1: 获取最近项目列表 (这部分总是执行)
    WITH TopPartner AS (
        SELECT DISTINCT ON (pp.project_id) pp.project_id, p.name AS partner_name
        FROM public.project_partners AS pp JOIN public.partners AS p ON pp.partner_id = p.id
        ORDER BY pp.project_id, pp.level DESC
    ), ProjectStartDate AS (
        SELECT project_id, MIN(loading_date) AS actual_start_date
        FROM public.logistics_records GROUP BY project_id
    )
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'name', p.name,
            'partner_name', tp.partner_name,
            'start_date', psd.actual_start_date,
            'planned_total_tons', p.planned_total_tons
        ) ORDER BY p.created_at DESC
    ) INTO v_recent_projects
    FROM (
        SELECT * FROM public.projects ORDER BY created_at DESC LIMIT 3
    ) AS p
    LEFT JOIN TopPartner AS tp ON p.id = tp.project_id
    LEFT JOIN ProjectStartDate AS psd ON p.id = psd.project_id;


    -- 【核心修复】: 只有当传入有效的项目ID时，才执行统计查询
    IF p_selected_project_id IS NOT NULL THEN
        -- 任务2: 获取今日日报
        SELECT get_project_daily_report(p_selected_project_id, p_report_date) INTO v_daily_report;
        -- 任务3: 获取7日趋势图
        SELECT get_project_7_day_trend(p_selected_project_id) INTO v_seven_day_trend;
        -- 任务4: 获取项目总览统计
        SELECT get_project_overall_stats(p_selected_project_id) INTO v_overall_stats;
    ELSE
        -- 如果是首次加载 (ID为null), 则为统计数据返回空或默认值
        v_daily_report := '{"total_tonnage":0,"driver_receivable":0,"partner_payable":0}';
        v_seven_day_trend := '[]';
        v_overall_stats := '{"total_trips":0,"total_tonnage":0,"total_cost":0,"avg_cost":0}';
    END IF;


    -- 任务5: 将所有结果合并到一个 JSON 对象中返回
    RETURN json_build_object(
        'recent_projects', v_recent_projects,
        'daily_report', v_daily_report,
        'seven_day_trend', v_seven_day_trend,
        'overall_stats', v_overall_stats
    );
END;
$$;
