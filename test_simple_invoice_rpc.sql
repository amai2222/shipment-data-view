-- 简化的开票申请RPC函数测试
-- 请在Supabase SQL编辑器中执行以下命令

-- 创建简化的测试函数
CREATE OR REPLACE FUNCTION public.test_invoice_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
    v_offset integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_records AS (
        SELECT v.*, lr.invoice_status
        FROM public.logistics_records_view AS v
        JOIN public.logistics_records lr ON v.id = lr.id
        WHERE
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            (
                p_invoice_status_array IS NULL OR
                array_length(p_invoice_status_array, 1) IS NULL OR
                LOWER(COALESCE(lr.invoice_status, 'Uninvoiced')) = ANY(ARRAY(SELECT lower(unnest) FROM unnest(p_invoice_status_array)))
            ) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
            ))
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY loading_date DESC
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'count', (SELECT COUNT(*) FROM filtered_records),
        'overview', (
            SELECT jsonb_build_object(
                'total_records', COALESCE(COUNT(*), 0),
                'total_current_cost', COALESCE(SUM(current_cost), 0),
                'total_extra_cost', COALESCE(SUM(extra_cost), 0),
                'total_payable_cost', COALESCE(SUM(payable_cost), 0)
            )
            FROM filtered_records
        ),
        'partner_invoiceables', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.partner_name), '[]'::jsonb) FROM (
                SELECT
                    lpc.partner_id, p.name AS partner_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    v.id, v.auto_number, v.project_name, v.driver_name, v.loading_location, v.unloading_location,
                    to_char(v.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(v.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    v.loading_weight, v.unloading_weight, v.current_cost, v.payable_cost, v.extra_cost,
                    v.license_plate, v.driver_phone, v.transport_type, v.remarks, v.chain_name,
                    COALESCE(lr.invoice_status, 'Uninvoiced') AS invoice_status,
                    v.billing_type_id,
                    -- 简化的合作方数据查询，避免复杂的子查询
                    '[]'::jsonb AS partner_costs
                FROM filtered_records v
                JOIN public.logistics_records lr ON v.id = lr.id
                WHERE v.id IN (SELECT id FROM paginated_records)
            ) t
        )
    )
    INTO result_json;

    RETURN result_json;
END;
$function$;

-- 测试简化函数
SELECT public.test_invoice_data(
    NULL,  -- p_project_id
    '2025-09-05'::date,  -- p_start_date
    '2025-09-08'::date,  -- p_end_date
    NULL,  -- p_partner_id
    ARRAY['Uninvoiced'],  -- p_invoice_status_array
    50,    -- p_page_size
    1      -- p_page_number
) as test_result;
