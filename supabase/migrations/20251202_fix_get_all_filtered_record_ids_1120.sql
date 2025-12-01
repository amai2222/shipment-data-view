-- ============================================================================
-- 修复并重命名 get_all_filtered_record_ids_1120 函数为 get_all_filtered_record_ids_1201
-- 日期：2025-12-02
-- 说明：修复不存在的列引用，使用 scale_records 表判断是否有磅单记录，并重命名函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids_1201(
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
    v_result jsonb;
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

    -- ✅ 修复：使用CTE优化查询，一次性获取所有需要的数据
    WITH filtered_records AS (
        SELECT 
            lr.id,
            lr.project_name,
            lr.driver_name,
            lr.loading_date
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
            -- ✅ 修复：使用 scale_records 表判断是否有磅单记录，而不是使用不存在的字段
            (p_has_scale_record IS NULL OR 
             p_has_scale_record = '' OR
             CASE 
                WHEN p_has_scale_record = 'yes' THEN 
                    EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                WHEN p_has_scale_record = 'no' THEN 
                    NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                ELSE true
             END) AND
            (p_invoice_status IS NULL OR p_invoice_status = '' OR lr.invoice_status = p_invoice_status) AND
            (p_payment_status IS NULL OR p_payment_status = '' OR lr.payment_status = p_payment_status) AND
            (p_receipt_status IS NULL OR p_receipt_status = '' OR lr.receipt_status = p_receipt_status)
    ),
    aggregated_data AS (
        SELECT 
            COALESCE(jsonb_agg(fr.id ORDER BY fr.loading_date DESC), '[]'::jsonb) as record_ids,
            COUNT(*)::int as total_count,
            COALESCE(jsonb_agg(DISTINCT fr.project_name ORDER BY fr.project_name) FILTER (WHERE fr.project_name IS NOT NULL), '[]'::jsonb) as project_names,
            COALESCE(jsonb_agg(DISTINCT fr.driver_name ORDER BY fr.driver_name) FILTER (WHERE fr.driver_name IS NOT NULL), '[]'::jsonb) as driver_names,
            TO_CHAR(MIN(fr.loading_date) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') as earliest_date,
            TO_CHAR(MAX(fr.loading_date) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') as latest_date
        FROM filtered_records fr
    )
    SELECT jsonb_build_object(
        'recordIds', COALESCE(ad.record_ids, '[]'::jsonb),
        'totalCount', COALESCE(ad.total_count, 0),
        'summary', jsonb_build_object(
            'projectNames', COALESCE(ad.project_names, '[]'::jsonb),
            'driverNames', COALESCE(ad.driver_names, '[]'::jsonb),
            'dateRange', jsonb_build_object(
                'earliest', ad.earliest_date,
                'latest', ad.latest_date
            )
        )
    )
    INTO v_result
    FROM aggregated_data ad;
    
    -- 处理空结果的情况（当 filtered_records 为空时，aggregated_data 可能为 NULL）
    IF v_result IS NULL THEN
        v_result := jsonb_build_object(
            'recordIds', '[]'::jsonb,
            'totalCount', 0,
            'summary', jsonb_build_object(
                'projectNames', '[]'::jsonb,
                'driverNames', '[]'::jsonb,
                'dateRange', jsonb_build_object('earliest', null, 'latest', null)
            )
        );
    END IF;
    
    -- ✅ 修复：返回格式与前端期望的格式匹配
    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.get_all_filtered_record_ids_1201 IS '获取所有筛选后的记录ID和日期范围（2025-12-02修复版本：修复不存在的列引用，重命名为1201版本）';

-- 验证
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_all_filtered_record_ids_1201 函数已创建';
    RAISE NOTICE '修复内容：使用 scale_records 表判断是否有磅单记录';
    RAISE NOTICE '========================================';
END $$;

