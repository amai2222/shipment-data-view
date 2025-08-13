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
BEGIN
    -- 遍历所有项目（如果指定了项目ID，则只处理这些项目）
    FOR project_record IN 
        SELECT id, name, planned_total_tons, 
               (SELECT partner_name FROM (
                   SELECT DISTINCT ON (pp.project_id) pp.project_id, p.name AS partner_name
                   FROM public.project_partners AS pp 
                   JOIN public.partners AS p ON pp.partner_id = p.id
                   WHERE pp.project_id = proj.id
                   ORDER BY pp.project_id, pp.level DESC
               ) AS tp WHERE tp.project_id = proj.id) AS partner_name,
               (SELECT MIN(loading_date)::date FROM public.logistics_records WHERE project_id = proj.id) AS start_date,
               COALESCE((SELECT billing_type_id FROM public.partner_chains WHERE project_id = proj.id LIMIT 1), 1) AS billing_type_id
        FROM public.projects proj
        WHERE (p_project_ids IS NULL OR proj.id = ANY(p_project_ids))
    LOOP
        -- 获取项目的单日报告
        WITH DriverBaseCosts AS (
            SELECT logistics_record_id, base_amount FROM public.logistics_partner_costs WHERE level = 1
        ), TopLevelPartnerCosts AS (
            SELECT logistics_record_id, payable_amount FROM public.logistics_partner_costs 
            WHERE (logistics_record_id, level) IN (
                SELECT logistics_record_id, MAX(level) FROM public.logistics_partner_costs GROUP BY logistics_record_id
            )
        ), DailyRecords AS (
            SELECT lr.id, COALESCE(lr.unloading_weight, lr.loading_weight) AS tonnage, 
                   dbc.base_amount AS driver_receivable, tlpc.payable_amount AS partner_payable
            FROM public.logistics_records lr
            LEFT JOIN DriverBaseCosts dbc ON lr.id = dbc.logistics_record_id
            LEFT JOIN TopLevelPartnerCosts tlpc ON lr.id = tlpc.logistics_record_id
            WHERE lr.project_id = project_record.id AND lr.loading_date::date = p_report_date
        )
        -- 获取项目7日趋势数据
        WITH date_series AS (
            SELECT generate_series(p_report_date - INTERVAL '6 days', p_report_date, '1 day'::interval)::date AS report_date
        )
        SELECT json_agg(json_build_object('date', TO_CHAR(ds.report_date, 'MM-DD'), 'receivable', COALESCE(daily_data.total_receivable, 0)) ORDER BY ds.report_date)
        INTO project_trend_data
        FROM date_series ds
        LEFT JOIN (
            SELECT lr.loading_date::date AS report_day, SUM(dbc.base_amount) AS total_receivable
            FROM public.logistics_records lr 
            LEFT JOIN (SELECT logistics_record_id, base_amount FROM public.logistics_partner_costs WHERE level = 1) dbc ON lr.id = dbc.logistics_record_id
            WHERE lr.project_id = project_record.id 
              AND lr.loading_date::date BETWEEN p_report_date - INTERVAL '6 days' AND p_report_date
            GROUP BY report_day
        ) AS daily_data ON ds.report_date = daily_data.report_day;

        -- 获取项目司机工作量数据
        WITH DriverBaseCosts AS (
            SELECT logistics_record_id, base_amount FROM public.logistics_partner_costs WHERE level = 1
        )
        SELECT COALESCE(json_agg(row_to_json(t) ORDER BY driver_name ASC), '[]'::json)
        INTO project_driver_data
        FROM (
            SELECT d.name AS driver_name, COUNT(lr.id) AS trip_count, 
                   SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage, 
                   SUM(dbc.base_amount) AS total_driver_receivable
            FROM public.logistics_records lr
            JOIN public.drivers d ON lr.driver_id = d.id
            LEFT JOIN DriverBaseCosts dbc ON lr.id = dbc.logistics_record_id
            WHERE lr.project_id = project_record.id AND lr.loading_date::date = p_report_date
            GROUP BY d.name
        ) t;

        -- 构建项目数据包
        v_all_projects_data := v_all_projects_data || jsonb_build_object(
            'project_details', jsonb_build_object(
                'id', project_record.id,
                'name', project_record.name,
                'partner_name', COALESCE(project_record.partner_name, '未知合作方'),
                'start_date', COALESCE(TO_CHAR(project_record.start_date, 'YYYY-MM-DD'), ''),
                'planned_total_tons', COALESCE(project_record.planned_total_tons, 0),
                'billing_type_id', project_record.billing_type_id
            ),
            'daily_report', (
                SELECT json_build_object(
                    'trip_count', COUNT(*), 
                    'total_tonnage', COALESCE(SUM(tonnage), 0), 
                    'driver_receivable', COALESCE(SUM(driver_receivable), 0), 
                    'partner_payable', COALESCE(SUM(partner_payable), 0)
                ) FROM (
                    SELECT lr.id, COALESCE(lr.unloading_weight, lr.loading_weight) AS tonnage, 
                           dbc.base_amount AS driver_receivable, tlpc.payable_amount AS partner_payable
                    FROM public.logistics_records lr
                    LEFT JOIN (SELECT logistics_record_id, base_amount FROM public.logistics_partner_costs WHERE level = 1) dbc ON lr.id = dbc.logistics_record_id
                    LEFT JOIN (SELECT logistics_record_id, payable_amount FROM public.logistics_partner_costs WHERE (logistics_record_id, level) IN (SELECT logistics_record_id, MAX(level) FROM public.logistics_partner_costs GROUP BY logistics_record_id)) tlpc ON lr.id = tlpc.logistics_record_id
                    WHERE lr.project_id = project_record.id AND lr.loading_date::date = p_report_date
                ) AS daily_records
            ),
            'summary_stats', (
                SELECT json_build_object(
                    'total_trips', COUNT(*),
                    'total_tonnage', COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0),
                    'total_cost', COALESCE(SUM(tlpc.payable_amount), 0),
                    'avg_cost', COALESCE(SUM(tlpc.payable_amount), 0) / NULLIF(COALESCE(SUM(COALESCE(lr.unloading_weight, lr.loading_weight)), 0), 0)
                )
                FROM public.logistics_records lr
                LEFT JOIN (SELECT logistics_record_id, payable_amount FROM public.logistics_partner_costs WHERE (logistics_record_id, level) IN (SELECT logistics_record_id, MAX(level) FROM public.logistics_partner_costs GROUP BY logistics_record_id)) tlpc ON lr.id = tlpc.logistics_record_id
                WHERE lr.project_id = project_record.id AND lr.loading_date::date <= p_report_date
            ),
            'seven_day_trend', COALESCE(project_trend_data, '[]'::jsonb),
            'driver_report_table', COALESCE(project_driver_data, '[]'::jsonb)
        );
    END LOOP;

    -- 获取全局7日趋势
    WITH date_series AS (
        SELECT generate_series(p_report_date - INTERVAL '6 days', p_report_date, '1 day'::interval)::date AS report_date
    )
    SELECT json_agg(json_build_object('date', TO_CHAR(ds.report_date, 'MM-DD'), 'receivable', COALESCE(daily_data.total_receivable, 0)) ORDER BY ds.report_date)
    INTO v_global_seven_day_trend
    FROM date_series ds
    LEFT JOIN (
        SELECT lr.loading_date::date AS report_day, SUM(dbc.base_amount) AS total_receivable
        FROM public.logistics_records lr 
        LEFT JOIN (SELECT logistics_record_id, base_amount FROM public.logistics_partner_costs WHERE level = 1) dbc ON lr.id = dbc.logistics_record_id
        WHERE (p_project_ids IS NULL OR lr.project_id = ANY(p_project_ids))
          AND lr.loading_date::date BETWEEN p_report_date - INTERVAL '6 days' AND p_report_date
        GROUP BY report_day
    ) AS daily_data ON ds.report_date = daily_data.report_day;

    -- 获取全局司机工作量
    WITH DriverBaseCosts AS (
        SELECT logistics_record_id, base_amount FROM public.logistics_partner_costs WHERE level = 1
    )
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY total_driver_receivable DESC), '[]'::json)
    INTO v_global_driver_report_table
    FROM (
        SELECT d.name AS driver_name, COUNT(lr.id) AS trip_count, 
               SUM(COALESCE(lr.unloading_weight, lr.loading_weight)) AS total_tonnage, 
               SUM(dbc.base_amount) AS total_driver_receivable
        FROM public.logistics_records lr
        JOIN public.drivers d ON lr.driver_id = d.id
        LEFT JOIN DriverBaseCosts dbc ON lr.id = dbc.logistics_record_id
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