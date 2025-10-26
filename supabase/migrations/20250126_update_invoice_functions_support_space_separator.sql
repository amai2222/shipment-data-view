-- ============================================================
-- 更新开票申请函数，支持逗号和空格分隔
-- 创建日期：2025-01-26
-- 说明：修改get_invoice_request_data函数，支持批量输入时使用逗号、空格或混合分隔
-- ============================================================

-- 删除旧版本函数
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_invoice_request_data'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', r.func_signature;
    END LOOP;
END $$;

-- 重新创建支持空格和逗号分隔的函数
CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1,
    -- 高级筛选参数
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

    -- 解析高级筛选参数（支持逗号、空格或混合分隔）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        -- 使用正则表达式同时支持逗号和空格作为分隔符
        waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        -- 过滤空字符串
        waybill_array := array_remove(waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        driver_array := array_remove(driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        license_array := array_remove(license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        phone_array := array_remove(phone_array, '');
    END IF;
    
    IF p_driver_receivable IS NOT NULL AND p_driver_receivable != '' THEN
        receivable_array := regexp_split_to_array(trim(p_driver_receivable), '[,\s]+');
        receivable_array := array_remove(receivable_array, '');
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
            -- 高级筛选条件（支持批量OR逻辑）
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
    ),
    detail_data AS (
        SELECT 
            json_agg(
                json_build_object(
                    'id', v.id,
                    'auto_number', v.auto_number,
                    'project_id', v.project_id,
                    'project_name', v.project_name,
                    'driver_id', v.driver_id,
                    'driver_name', v.driver_name,
                    'driver_phone', v.driver_phone,
                    'license_plate', v.license_plate,
                    'loading_location', v.loading_location,
                    'unloading_location', v.unloading_location,
                    'loading_date', v.loading_date,
                    'unloading_date', v.unloading_date,
                    'cargo_type', v.cargo_type,
                    'loading_weight', v.loading_weight,
                    'unloading_weight', v.unloading_weight,
                    'current_cost', v.current_cost,
                    'chain_name', v.chain_name,
                    'invoice_status', v.invoice_status,
                    'partner_costs', COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'partner_id', lpc.partner_id,
                                    'partner_name', p.name,
                                    'level', lpc.level,
                                    'base_amount', lpc.base_amount,
                                    'payable_amount', lpc.payable_amount,
                                    'tax_rate', lpc.tax_rate,
                                    'invoice_status', lpc.invoice_status
                                ) ORDER BY lpc.level
                            )
                            FROM public.logistics_partner_costs lpc
                            JOIN public.partners p ON lpc.partner_id = p.id
                            WHERE lpc.logistics_record_id = v.id
                        ),
                        '[]'::json
                    )
                ) ORDER BY v.auto_number DESC, v.loading_date DESC
            ) as records
        FROM public.logistics_records_view v
        JOIN filtered_records fr ON v.id = fr.id
        JOIN paginated_records pr ON v.id = pr.id
    )
    SELECT json_build_object(
        'records', COALESCE((SELECT records FROM detail_data), '[]'::json),
        'total_count', COALESCE((SELECT count FROM total_count), 0),
        'page_size', p_page_size,
        'page_number', p_page_number
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_invoice_request_data IS '
开票申请数据获取函数
- 支持批量查询（逗号、空格或混合分隔，OR逻辑）：运单编号、司机姓名、车牌号、电话号码、应收金额
- 批量输入示例："张三,李四" 或 "张三 李四" 或 "张三, 李四"
';

-- 授权
GRANT EXECUTE ON FUNCTION public.get_invoice_request_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_request_data TO anon;

-- 测试查询示例
-- 基础查询
-- SELECT * FROM public.get_invoice_request_data();

-- 批量司机筛选（支持逗号、空格或混合分隔）
-- SELECT * FROM public.get_invoice_request_data(p_driver_name => '张三,李四');
-- SELECT * FROM public.get_invoice_request_data(p_driver_name => '张三 李四');
-- SELECT * FROM public.get_invoice_request_data(p_driver_name => '张三, 李四, 王五');

-- 批量车牌号筛选
-- SELECT * FROM public.get_invoice_request_data(p_license_plate => '京A12345,京B67890');
-- SELECT * FROM public.get_invoice_request_data(p_license_plate => '京A12345 京B67890');

-- 批量运单编号筛选
-- SELECT * FROM public.get_invoice_request_data(p_waybill_numbers => 'WB001,WB002,WB003');
-- SELECT * FROM public.get_invoice_request_data(p_waybill_numbers => 'WB001 WB002 WB003');

