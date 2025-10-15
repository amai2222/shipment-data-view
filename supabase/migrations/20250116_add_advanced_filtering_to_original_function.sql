-- 为原始get_invoice_request_data函数添加高级筛选支持
-- 文件: supabase/migrations/20250116_add_advanced_filtering_to_original_function.sql

-- 先删除原始函数
DROP FUNCTION IF EXISTS public.get_invoice_request_data(uuid, date, date, uuid, text[], integer, integer);

-- 重新创建支持高级筛选的函数
CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1,
    -- 新增高级筛选参数
    p_waybill_numbers text DEFAULT NULL::text,
    p_driver_name text DEFAULT NULL::text,
    p_license_plate text DEFAULT NULL::text,
    p_driver_phone text DEFAULT NULL::text,
    p_driver_receivable text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json json;
    v_offset integer;
    waybill_array text[];
    driver_array text[];
    license_array text[];
    phone_array text[];
    receivable_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    -- 解析高级筛选参数
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        waybill_array := string_to_array(p_waybill_numbers, ',');
        -- 手动去除空白字符
        SELECT array_agg(trim(item)) INTO waybill_array FROM unnest(waybill_array) AS item WHERE trim(item) != '';
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        driver_array := string_to_array(p_driver_name, ',');
        -- 手动去除空白字符
        SELECT array_agg(trim(item)) INTO driver_array FROM unnest(driver_array) AS item WHERE trim(item) != '';
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        license_array := string_to_array(p_license_plate, ',');
        -- 手动去除空白字符
        SELECT array_agg(trim(item)) INTO license_array FROM unnest(license_array) AS item WHERE trim(item) != '';
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        phone_array := string_to_array(p_driver_phone, ',');
        -- 手动去除空白字符
        SELECT array_agg(trim(item)) INTO phone_array FROM unnest(phone_array) AS item WHERE trim(item) != '';
    END IF;
    
    IF p_driver_receivable IS NOT NULL AND p_driver_receivable != '' THEN
        receivable_array := string_to_array(p_driver_receivable, ',');
        -- 手动去除空白字符
        SELECT array_agg(trim(item)) INTO receivable_array FROM unnest(receivable_array) AS item WHERE trim(item) != '';
    END IF;

    WITH filtered_records AS (
        SELECT v.*, lr.invoice_status
        FROM public.logistics_records_view AS v
        JOIN public.logistics_records lr ON v.id = lr.id
        WHERE
            -- 基本筛选条件
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array)) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
            )) AND
            -- 高级筛选条件
            (waybill_array IS NULL OR v.auto_number = ANY(waybill_array) OR 
             EXISTS (SELECT 1 FROM unnest(waybill_array) AS wb WHERE v.auto_number ILIKE '%' || wb || '%')) AND
            (driver_array IS NULL OR v.driver_name = ANY(driver_array) OR 
             EXISTS (SELECT 1 FROM unnest(driver_array) AS dr WHERE v.driver_name ILIKE '%' || dr || '%')) AND
            (license_array IS NULL OR v.license_plate = ANY(license_array) OR 
             EXISTS (SELECT 1 FROM unnest(license_array) AS lp WHERE v.license_plate ILIKE '%' || lp || '%')) AND
            (phone_array IS NULL OR v.driver_phone = ANY(phone_array) OR 
             EXISTS (SELECT 1 FROM unnest(phone_array) AS ph WHERE v.driver_phone ILIKE '%' || ph || '%')) AND
            (receivable_array IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(receivable_array) AS rc WHERE v.current_cost::text ILIKE '%' || rc || '%'))
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY auto_number DESC, loading_date DESC
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_records
    )
    SELECT jsonb_build_object(
        'count', (SELECT count FROM total_count),
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
            SELECT COALESCE(jsonb_agg(t ORDER BY t.auto_number DESC, t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    v.id, v.auto_number, v.project_name, v.driver_name, v.loading_location, v.unloading_location,
                    to_char(v.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(v.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    v.loading_weight, v.unloading_weight, v.current_cost, v.payable_cost, v.extra_cost,
                    v.license_plate, v.driver_phone, v.transport_type, v.remarks, v.chain_name,
                    lr.invoice_status AS invoice_status,
                    v.billing_type_id,
                    COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', p.name,
                                'level', lpc.level,
                                'base_amount', lpc.base_amount,
                                'payable_amount', lpc.payable_amount,
                                'tax_rate', lpc.tax_rate,
                                'invoice_status', lpc.invoice_status,
                                'payment_status', lpc.payment_status
                            )
                        )
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners p ON lpc.partner_id = p.id
                        WHERE lpc.logistics_record_id = v.id
                    ), '[]'::jsonb) AS partner_costs
                FROM public.logistics_records_view v
                JOIN public.logistics_records lr ON v.id = lr.id
                WHERE v.id IN (SELECT id FROM paginated_records)
            ) t
        )
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_invoice_request_data IS '获取开票申请数据，支持基本筛选和高级筛选（运单编号、司机、车牌号、司机电话、司机应收），支持分页';
