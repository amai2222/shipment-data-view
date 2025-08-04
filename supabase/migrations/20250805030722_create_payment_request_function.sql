-- 文件路径: supabase/migrations/YYYYMMDDHHMMSS_create_payment_request_function.sql
-- 描述: [CzkRO 最终修复版] 创建一个全新的、独立的函数 get_payment_request_data，
--       专门用于付款申请页面，以避免影响其他功能。
--       同时，暂时移除了对不存在的 project_partner_chains 表的查询来修复 "relation does not exist" 错误。

CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_payment_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    result_json json;
    v_offset integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_records AS (
        SELECT r.*
        FROM logistics_records r
        WHERE
            (p_project_id IS NULL OR r.project_id = p_project_id) AND
            (p_start_date IS NULL OR r.loading_date >= p_start_date) AND
            (p_end_date IS NULL OR r.loading_date <= p_end_date) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM jsonb_to_populate_recordset(null::partner_cost_type, r.partner_costs) AS pc
                WHERE pc.partner_id = p_partner_id::text
            )) AND
            (p_payment_status_array IS NULL OR array_length(p_payment_status_array, 1) IS NULL OR r.payment_status = ANY(p_payment_status_array))
    ),
    total_count AS (
        SELECT count(*) as count FROM filtered_records
    )
    SELECT json_build_object(
        'count', (SELECT count FROM total_count),
        'records', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', fr.id,
                    'auto_number', fr.auto_number,
                    'project_name', p.name,
                    'driver_id', fr.driver_id,
                    'driver_name', d.name,
                    'loading_location', fr.loading_location,
                    'unloading_location', fr.unloading_location,
                    'loading_date', fr.loading_date,
                    'unloading_date', fr.unloading_date,
                    'license_plate', d.license_plate,
                    'driver_phone', d.phone,
                    'payable_cost', fr.payable_cost,
                    'partner_costs', fr.partner_costs,
                    'payment_status', fr.payment_status,
                    'current_cost', fr.current_cost,
                    'extra_cost', fr.extra_cost,
                    -- 关键修复：移除了对 ppc.name 的引用，使用 NULL 作为占位符
                    'chain_name', NULL 
                )
            )
            FROM (
                SELECT * FROM filtered_records
                ORDER BY loading_date DESC, auto_number DESC
                LIMIT p_page_size OFFSET v_offset
            ) fr
            JOIN projects p ON fr.project_id = p.id
            JOIN drivers d ON fr.driver_id = d.id
            -- 关键修复：彻底移除了对不存在的 project_partner_chains 表的 LEFT JOIN
        ), '[]'::json),
        'overview', (
            SELECT json_build_object(
                'total_records', count(*),
                'total_current_cost', COALESCE(sum(current_cost), 0),
                'total_extra_cost', COALESCE(sum(extra_cost), 0),
                'total_payable_cost', COALESCE(sum(payable_cost), 0)
            ) FROM filtered_records
        ),
        'partner_payables', COALESCE((
            SELECT json_agg(t) FROM (
                SELECT
                    pc.partner_id,
                    pc.partner_name,
                    count(*) as records_count,
                    sum(pc.payable_amount) as total_payable
                FROM filtered_records,
                LATERAL jsonb_to_populate_recordset(null::partner_cost_type, partner_costs) AS pc
                GROUP BY pc.partner_id, pc.partner_name
                ORDER BY sum(pc.payable_amount) DESC
            ) t
        ), '[]'::json)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;
