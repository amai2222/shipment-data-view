-- 最终的开票申请RPC函数修复
-- 请在Supabase SQL编辑器中执行以下命令

-- 删除有问题的函数
DROP FUNCTION IF EXISTS get_invoice_request_data(uuid,date,date,uuid,text[],integer,integer);
DROP FUNCTION IF EXISTS get_invoice_request_data_v2(uuid,date,date,uuid,text[],integer,integer);
DROP FUNCTION IF EXISTS get_filtered_uninvoiced_record_ids(uuid,date,date,uuid,text[]);
DROP FUNCTION IF EXISTS save_invoice_request(uuid[],text);
DROP FUNCTION IF EXISTS test_invoice_data(uuid,date,date,uuid,text[],integer,integer);

-- 创建最终修复的开票申请RPC函数
CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
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
                    COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', par.name,
                                'level', lpc.level,
                                'payable_amount', lpc.payable_amount
                            ) ORDER BY lpc.level
                        )
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners par ON lpc.partner_id = par.id
                        WHERE lpc.logistics_record_id = v.id
                    ), '[]'::jsonb) AS partner_costs
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

-- 创建其他必要的RPC函数
CREATE OR REPLACE FUNCTION public.get_filtered_uninvoiced_record_ids(
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid,
    p_invoice_status_array text[] DEFAULT NULL::text[]
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_ids uuid[];
BEGIN
    SELECT array_agg(v.id)
    INTO result_ids
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
        ));

    RETURN COALESCE(result_ids, '{}'::uuid[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invoice_request_data_v2(
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
BEGIN
    RETURN public.get_invoice_request_data(
        p_project_id,
        p_start_date,
        p_end_date,
        p_partner_id,
        p_invoice_status_array,
        p_page_size,
        p_page_number
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_invoice_request(
    p_record_ids uuid[],
    p_invoice_status text DEFAULT 'Processing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
    updated_count integer := 0;
BEGIN
    -- 更新logistics_records表的invoice_status
    UPDATE logistics_records 
    SET invoice_status = p_invoice_status
    WHERE id = ANY(p_record_ids);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- 更新logistics_partner_costs表的invoice_status
    UPDATE logistics_partner_costs 
    SET invoice_status = p_invoice_status
    WHERE logistics_record_id = ANY(p_record_ids);
    
    result_json := jsonb_build_object(
        'success', true,
        'updated_records', updated_count,
        'message', '开票申请保存成功'
    );
    
    RETURN result_json;
END;
$function$;
