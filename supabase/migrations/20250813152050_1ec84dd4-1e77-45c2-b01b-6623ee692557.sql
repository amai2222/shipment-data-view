CREATE OR REPLACE FUNCTION public.get_all_projects_overview_data(p_report_date date, p_project_ids uuid[] DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_all_projects_data jsonb := '[]'::jsonb;
    v_global_seven_day_trend jsonb := '[]'::jsonb;
    v_global_driver_report_table jsonb := '[]'::jsonb;
    v_global_summary jsonb;
    project_record RECORD;
    project_trend_data jsonb;
    project_driver_data jsonb;
    daily_report_data jsonb;
    summary_stats_data jsonb;
BEGIN
    -- 遍历所有项目
    FOR project_record IN 
        SELECT p.id, p.name, p.planned_total_tons,
               COALESCE((
                   SELECT pt.name 
                   FROM public.project_partners pp 
                   JOIN public.partners pt ON pp.partner_id = pt.id
                   WHERE pp.project_id = p.id
                   ORDER BY pp.level DESC
                   LIMIT 1
               ), '未知合作方') AS partner_name,
               COALESCE((SELECT MIN(loading_date)::date FROM public.logistics_records WHERE project_id = p.id), CURRENT_DATE) AS start_date,
               COALESCE((SELECT billing_type_id FROM public.partner_chains WHERE project_id = p.id LIMIT 1), 1) AS billing_type_id
        FROM public.projects p
        WHERE (p_project_ids IS NULL OR p.id = ANY(p_project_ids))
    LOOP
        -- 获取项目7日趋势数据
        SELECT json_agg(json_build_object('date', TO_CHAR(ds.report_date, 'MM-DD'), 'receivable', COALESCE(daily_data.total_receivable, 0)) ORDER BY ds.report_date)
        INTO project_trend_data
        FROM generate_series(p_report_date - INTERVAL '6 days', p_report_date, '1 day'::interval)::date ds(report_date)
        LEFT JOIN (
            SELECT lr.loading_date::date AS report_day, SUM(lpc.base_amount) AS total_receivable
            FROM public.logistics_records lr 
            LEFT JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id AND lpc.level = 1
            WHERE lr.project_id = project_record.id 
              AND lr.loading_date::date BETWEEN p_report_date - INTERVAL '6 days' AND p_report_date
            GROUP BY report_day
        ) daily_data ON ds.report_date = daily_data.report_day;

        -- 获取项目司机工作量数据
        SELECT COALESCE(json_agg(row_to_json(t) ORDER BY driver_name ASC), '[]'::json)
        INTO project_driver_data
        FROM (
            SELECT d.name AS driver_name, COUNT(lr.id) AS trip_count, 
                   SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage, 
                   SUM(lpc.base_amount) AS total_driver_receivable
            FROM public.logistics_records lr
            JOIN public.drivers d ON lr.driver_id = d.id
            LEFT JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id AND lpc.level = 1
            WHERE lr.project_id = project_record.id AND lr.loading_date::date = p_report_date
            GROUP BY d.name
        ) t;

        -- 获取当日报告数据
        SELECT json_build_object(
            'trip_count', COUNT(*), 
            'total_tonnage', COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0), 
            'driver_receivable', COALESCE(SUM(lpc.base_amount), 0), 
            'partner_payable', COALESCE(SUM(tlpc.payable_amount), 0)
        )
        INTO daily_report_data
        FROM public.logistics_records lr
        LEFT JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id AND lpc.level = 1
        LEFT JOIN (
            SELECT logistics_record_id, payable_amount 
            FROM public.logistics_partner_costs 
            WHERE (logistics_record_id, level) IN (
                SELECT logistics_record_id, MAX(level) 
                FROM public.logistics_partner_costs 
                GROUP BY logistics_record_id
            )
        ) tlpc ON lr.id = tlpc.logistics_record_id
        WHERE lr.project_id = project_record.id AND lr.loading_date::date = p_report_date;

        -- 获取项目总计数据
        SELECT json_build_object(
            'total_trips', COUNT(*),
            'total_tonnage', COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0),
            'total_cost', COALESCE(SUM(tlpc.payable_amount), 0),
            'avg_cost', CASE WHEN SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) > 0 
                           THEN COALESCE(SUM(tlpc.payable_amount), 0) / SUM(COALESCE(lr.unloading_weight, lr.loading_weight))
                           ELSE 0 END
        )
        INTO summary_stats_data
        FROM public.logistics_records lr
        LEFT JOIN (
            SELECT logistics_record_id, payable_amount 
            FROM public.logistics_partner_costs 
            WHERE (logistics_record_id, level) IN (
                SELECT logistics_record_id, MAX(level) 
                FROM public.logistics_partner_costs 
                GROUP BY logistics_record_id
            )
        ) tlpc ON lr.id = tlpc.logistics_record_id
        WHERE lr.project_id = project_record.id AND lr.loading_date::date <= p_report_date;

        -- 构建项目数据包
        v_all_projects_data := v_all_projects_data || jsonb_build_object(
            'project_details', jsonb_build_object(
                'id', project_record.id,
                'name', project_record.name,
                'partner_name', project_record.partner_name,
                'start_date', TO_CHAR(project_record.start_date, 'YYYY-MM-DD'),
                'planned_total_tons', COALESCE(project_record.planned_total_tons, 0),
                'billing_type_id', project_record.billing_type_id
            ),
            'daily_report', COALESCE(daily_report_data, '{"trip_count":0,"total_tonnage":0,"driver_receivable":0,"partner_payable":0}'::jsonb),
            'summary_stats', COALESCE(summary_stats_data, '{"total_trips":0,"total_tonnage":0,"total_cost":0,"avg_cost":0}'::jsonb),
            'seven_day_trend', COALESCE(project_trend_data, '[]'::jsonb),
            'driver_report_table', COALESCE(project_driver_data, '[]'::jsonb)
        );
    END LOOP;

    -- 获取全局7日趋势
    SELECT json_agg(json_build_object('date', TO_CHAR(ds.report_date, 'MM-DD'), 'receivable', COALESCE(daily_data.total_receivable, 0)) ORDER BY ds.report_date)
    INTO v_global_seven_day_trend
    FROM generate_series(p_report_date - INTERVAL '6 days', p_report_date, '1 day'::interval)::date ds(report_date)
    LEFT JOIN (
        SELECT lr.loading_date::date AS report_day, SUM(lpc.base_amount) AS total_receivable
        FROM public.logistics_records lr 
        LEFT JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id AND lpc.level = 1
        WHERE (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
          AND lr.loading_date::date BETWEEN p_report_date - INTERVAL '6 days' AND p_report_date
        GROUP BY report_day
    ) daily_data ON ds.report_date = daily_data.report_day;

    -- 获取全局司机工作量
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY total_driver_receivable DESC), '[]'::json)
    INTO v_global_driver_report_table
    FROM (
        SELECT d.name AS driver_name, COUNT(lr.id) AS trip_count, 
               SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage, 
               SUM(lpc.base_amount) AS total_driver_receivable
        FROM public.logistics_records lr
        JOIN public.drivers d ON lr.driver_id = d.id
        LEFT JOIN public.logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id AND lpc.level = 1
        WHERE (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
          AND lr.loading_date::date = p_report_date
        GROUP BY d.name
        HAVING COUNT(lr.id) > 0
    ) t;

    -- 获取全局统计
    SELECT json_build_object(
        'total_projects', (SELECT COUNT(*) FROM jsonb_array_elements(v_all_projects_data)),
        'total_receivable', (
            SELECT COALESCE(SUM((element->'summary_stats'->>'total_cost')::numeric), 0)
            FROM jsonb_array_elements(v_all_projects_data) AS element
        ),
        'total_trips', (
            SELECT COALESCE(SUM((element->'summary_stats'->>'total_trips')::numeric), 0)
            FROM jsonb_array_elements(v_all_projects_data) AS element
        )
    ) INTO v_global_summary;

    RETURN json_build_object(
        'all_projects_data', v_all_projects_data,
        'global_seven_day_trend', COALESCE(v_global_seven_day_trend, '[]'::jsonb),
        'global_driver_report_table', COALESCE(v_global_driver_report_table, '[]'::jsonb),
        'global_summary', v_global_summary
    );
END;
$function$