-- 文件路径: supabase/migrations/20250805030722_create_payment_request_function.sql
-- 描述: [Hnq2n 最终蓝图修复版] 根据用户提供的真实数据库结构，
--       正确地 LEFT JOIN 到 partner_chains 表以获取 chain_name。

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
                    -- 关键修复：从正确的表 pc (partner_chains) 中获取正确的列 chain_name
                    'chain_name', pc.chain_name
                )
            )
            FROM (
                SELECT * FROM filtered_records
                ORDER BY loading_date DESC, auto_number DESC
                LIMIT p_page_size OFFSET v_offset
            ) fr
            JOIN projects p ON fr.project_id = p.id
            JOIN drivers d ON fr.driver_id = d.id
            -- 关键修复：LEFT JOIN 到正确的表 partner_chains
            LEFT JOIN partner_chains pc ON fr.chain_id = pc.id
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
                    pc_data.partner_id,
                    pc_data.partner_name,
                    count(*) as records_count,
                    sum(pc_data.payable_amount) as total_payable
                FROM filtered_records,
                LATERAL jsonb_to_populate_recordset(null::partner_cost_type, partner_costs) AS pc_data
                GROUP BY pc_data.partner_id, pc_data.partner_name
                ORDER BY sum(pc_data.payable_amount) DESC
            ) t
        ), '[]'::json)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;
