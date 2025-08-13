-- 更新get_finance_reconciliation_data函数，使用本地billing_type_id字段
CREATE OR REPLACE FUNCTION public.get_finance_reconciliation_data(
    p_project_id uuid DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result_json jsonb;
    filtered_record_ids uuid[];
BEGIN
    -- 找出所有符合条件的运单ID，直接从logistics_records表查询
    SELECT ARRAY_AGG(lr.id)
    INTO filtered_record_ids
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE
        (p_project_id IS NULL OR lr.project_id = p_project_id) AND
        (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date) AND
        (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date) AND
        (p_partner_id IS NULL OR EXISTS (
            SELECT 1 FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
        ));

    -- 构建包含所有结果的单一JSON对象
    SELECT jsonb_build_object(
        'overview', (
            SELECT jsonb_build_object(
                'total_records', COALESCE(COUNT(*), 0),
                'total_current_cost', COALESCE(SUM(current_cost), 0),
                'total_extra_cost', COALESCE(SUM(extra_cost), 0),
                'total_payable_cost', COALESCE(SUM(payable_cost), 0)
            )
            FROM public.logistics_records
            WHERE id = ANY(COALESCE(filtered_record_ids, '{}'))
        ),
        'partner_payables', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.partner_name), '[]'::jsonb) FROM (
                SELECT
                    lpc.partner_id, p.name AS partner_name,
                    COUNT(lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                WHERE lpc.logistics_record_id = ANY(COALESCE(filtered_record_ids, '{}'))
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    lr.id, lr.auto_number, lr.project_name, lr.driver_name, 
                    lr.loading_location, lr.unloading_location,
                    to_char(lr.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(lr.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    lr.loading_weight, lr.unloading_weight, lr.current_cost, 
                    lr.payable_cost, lr.extra_cost, lr.license_plate, 
                    lr.driver_phone, lr.transport_type, lr.remarks,
                    lr.billing_type_id, -- 添加billing_type_id字段
                    pc.chain_name,
                    (SELECT COALESCE(jsonb_agg(sub ORDER BY sub.level), '[]'::jsonb) FROM (
                        SELECT lpc.partner_id, par.name AS partner_name, lpc.level, lpc.payable_amount
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners par ON lpc.partner_id = par.id
                        WHERE lpc.logistics_record_id = lr.id
                     ) sub
                    ) AS partner_costs
                FROM public.logistics_records lr
                LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
                WHERE lr.id = ANY(COALESCE(filtered_record_ids, '{}'))
            ) t
        ),
        'count', COALESCE(array_length(filtered_record_ids, 1), 0)
    )
    INTO result_json;

    RETURN result_json;
END;
$$;