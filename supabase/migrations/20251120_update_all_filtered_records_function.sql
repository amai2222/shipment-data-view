-- ============================================================================
-- 更新 get_all_filtered_record_ids 函数为 _1120 版本
-- 日期：2025-11-20
-- 说明：保持函数逻辑不变，只更新版本后缀
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids_1120(
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_project_name text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_has_scale_record text DEFAULT NULL::text,
    p_invoice_status text DEFAULT NULL::text,
    p_payment_status text DEFAULT NULL::text,
    p_receipt_status text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_record_ids jsonb;
    v_date_range jsonb;
BEGIN
    -- 解析批量输入参数
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    -- 获取所有符合筛选条件的记录ID
    SELECT jsonb_agg(id)
    INTO v_record_ids
    FROM public.logistics_records lr
    WHERE
        (p_start_date IS NULL OR p_start_date = '' OR 
         lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
        (p_end_date IS NULL OR p_end_date = '' OR 
         lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
        (p_project_name IS NULL OR lr.project_name = p_project_name) AND
        (v_driver_array IS NULL OR lr.driver_name = ANY(v_driver_array)) AND
        (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array)) AND
        (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array)) AND
        (p_other_platform_name IS NULL OR 
         p_other_platform_name = '' OR 
         p_other_platform_name = ANY(lr.other_platform_names)) AND
        (v_waybill_array IS NULL OR 
         EXISTS (
            SELECT 1 
            FROM unnest(lr.external_tracking_numbers) AS etn 
            WHERE etn = ANY(v_waybill_array)
         ) OR
         lr.auto_number = ANY(v_waybill_array)) AND
        (p_has_scale_record IS NULL OR 
         p_has_scale_record = '' OR
         CASE 
            WHEN p_has_scale_record = '有磅单' THEN 
                (lr.loading_weighbridge_image_url IS NOT NULL OR lr.unloading_weighbridge_image_url IS NOT NULL)
            WHEN p_has_scale_record = '无磅单' THEN 
                (lr.loading_weighbridge_image_url IS NULL AND lr.unloading_weighbridge_image_url IS NULL)
            ELSE true
         END) AND
        (p_invoice_status IS NULL OR p_invoice_status = '' OR lr.invoice_status = p_invoice_status) AND
        (p_payment_status IS NULL OR p_payment_status = '' OR lr.payment_status = p_payment_status) AND
        (p_receipt_status IS NULL OR p_receipt_status = '' OR lr.receipt_status = p_receipt_status);
    
    -- 获取日期范围
    SELECT jsonb_build_object(
        'earliest', TO_CHAR(MIN(lr.loading_date) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'),
        'latest', TO_CHAR(MAX(lr.loading_date) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')
    )
    INTO v_date_range
    FROM public.logistics_records lr
    WHERE
        (p_start_date IS NULL OR p_start_date = '' OR 
         lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
        (p_end_date IS NULL OR p_end_date = '' OR 
         lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
        (p_project_name IS NULL OR lr.project_name = p_project_name) AND
        (v_driver_array IS NULL OR lr.driver_name = ANY(v_driver_array)) AND
        (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array)) AND
        (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array)) AND
        (p_other_platform_name IS NULL OR 
         p_other_platform_name = '' OR 
         p_other_platform_name = ANY(lr.other_platform_names)) AND
        (v_waybill_array IS NULL OR 
         EXISTS (
            SELECT 1 
            FROM unnest(lr.external_tracking_numbers) AS etn 
            WHERE etn = ANY(v_waybill_array)
         ) OR
         lr.auto_number = ANY(v_waybill_array)) AND
        (p_has_scale_record IS NULL OR 
         p_has_scale_record = '' OR
         CASE 
            WHEN p_has_scale_record = '有磅单' THEN 
                (lr.loading_weighbridge_image_url IS NOT NULL OR lr.unloading_weighbridge_image_url IS NOT NULL)
            WHEN p_has_scale_record = '无磅单' THEN 
                (lr.loading_weighbridge_image_url IS NULL AND lr.unloading_weighbridge_image_url IS NULL)
            ELSE true
         END) AND
        (p_invoice_status IS NULL OR p_invoice_status = '' OR lr.invoice_status = p_invoice_status) AND
        (p_payment_status IS NULL OR p_payment_status = '' OR lr.payment_status = p_payment_status) AND
        (p_receipt_status IS NULL OR p_receipt_status = '' OR lr.receipt_status = p_receipt_status);
    
    RETURN jsonb_build_object(
        'record_ids', COALESCE(v_record_ids, '[]'::jsonb),
        'date_range', COALESCE(v_date_range, jsonb_build_object('earliest', null, 'latest', null))
    );
END;
$function$;

COMMENT ON FUNCTION public.get_all_filtered_record_ids_1120 IS '获取所有筛选后的记录ID和日期范围（2025-11-20版本）';

-- 验证
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_all_filtered_record_ids_1120 函数已创建';
    RAISE NOTICE '========================================';
END $$;

