-- 为开票申请数据获取函数添加高级筛选支持
-- 文件: supabase/migrations/20250116_add_advanced_filtering_to_invoice_request_data.sql

-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_invoice_request_data(uuid, date, date, uuid, text[], integer, integer);

-- 创建新的get_invoice_request_data函数，添加高级筛选参数
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
        -- 去除空白字符
        waybill_array := array_remove(array_trim(waybill_array), '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        driver_array := string_to_array(p_driver_name, ',');
        driver_array := array_remove(array_trim(driver_array), '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        license_array := string_to_array(p_license_plate, ',');
        license_array := array_remove(array_trim(license_array), '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        phone_array := string_to_array(p_driver_phone, ',');
        phone_array := array_remove(array_trim(phone_array), '');
    END IF;
    
    IF p_driver_receivable IS NOT NULL AND p_driver_receivable != '' THEN
        receivable_array := string_to_array(p_driver_receivable, ',');
        receivable_array := array_remove(array_trim(receivable_array), '');
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
        'records', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', fr.id,
                        'auto_number', fr.auto_number,
                        'project_name', fr.project_name,
                        'driver_name', fr.driver_name,
                        'loading_location', fr.loading_location,
                        'unloading_location', fr.unloading_location,
                        'loading_weight', fr.loading_weight,
                        'unloading_weight', fr.unloading_weight,
                        'loading_date', fr.loading_date,
                        'current_cost', fr.current_cost,
                        'license_plate', fr.license_plate,
                        'driver_phone', fr.driver_phone,
                        'invoice_status', fr.invoice_status,
                        'partners', (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', p.id,
                                    'name', p.name,
                                    'level', p.level,
                                    'cost', p.payable_cost
                                )
                            )
                            FROM (
                                SELECT 
                                    lpc.partner_id as id,
                                    pp.name,
                                    lpc.level,
                                    lpc.payable_cost as cost
                                FROM logistics_partner_costs lpc
                                JOIN partners pp ON lpc.partner_id = pp.id
                                WHERE lpc.logistics_record_id = fr.id
                                ORDER BY lpc.level ASC
                            ) p
                        )
                    )
                )
                FROM (
                    SELECT * FROM filtered_records
                    WHERE id IN (SELECT id FROM paginated_records)
                ) fr
            ), '[]'::jsonb)
        )
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- 更新函数注释
COMMENT ON FUNCTION public.get_invoice_request_data IS '获取开票申请数据，支持基本筛选和高级筛选（运单编号、司机、车牌号、司机电话、司机应收），支持分页';
