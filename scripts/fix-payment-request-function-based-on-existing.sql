-- 基于现有数据库代码修复 get_payment_request_data 函数
-- 保持原有逻辑，只修复参数顺序问题

BEGIN;

-- 1. 删除可能存在的旧版本函数（避免冲突）
DROP FUNCTION IF EXISTS public.get_payment_request_data(uuid, date, date, uuid, text[], integer, integer);
DROP FUNCTION IF EXISTS public.get_payment_request_data(date, integer, integer, uuid, text[], uuid, date);
DROP FUNCTION IF EXISTS public.get_payment_request_data(text, integer, integer, uuid, text[], uuid, text);

-- 2. 重新创建函数，保持你原有的逻辑，只修复参数顺序
CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_payment_status_array text[] DEFAULT NULL::text[], 
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
        SELECT v.*, lr.payment_status
        FROM public.logistics_records_view AS v
        JOIN public.logistics_records lr ON v.id = lr.id
        WHERE
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            (
                p_payment_status_array IS NULL OR
                array_length(p_payment_status_array, 1) IS NULL OR
                LOWER(lr.payment_status) = ANY(ARRAY(SELECT lower(unnest) FROM unnest(p_payment_status_array)))
            ) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
            ))
            -- 注意：移除了 p_driver_names 参数，因为前端没有传递这个参数
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
        'partner_payables', (
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
                    v.payment_status,
                    v.billing_type_id, -- 保持原有的计费类型ID
                    (SELECT COALESCE(jsonb_agg(sub ORDER BY sub.level), '[]'::jsonb) FROM (
                        SELECT lpc.partner_id, par.name AS partner_name, lpc.level, lpc.payable_amount
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners par ON lpc.partner_id = par.id
                        WHERE lpc.logistics_record_id = v.id
                     ) sub
                    ) AS partner_costs
                FROM filtered_records v
                WHERE v.id IN (SELECT id FROM paginated_records)
            ) t
        )
    )
    INTO result_json;

    RETURN result_json;
END;
$function$;

-- 3. 验证函数创建成功
SELECT 'get_payment_request_data function created successfully based on existing code' as status;

-- 4. 测试函数是否正常工作
SELECT public.get_payment_request_data(
    p_project_id := NULL,
    p_start_date := NULL,
    p_end_date := NULL,
    p_partner_id := NULL,
    p_payment_status_array := NULL,
    p_page_size := 5,
    p_page_number := 1
) as test_result;

COMMIT;
