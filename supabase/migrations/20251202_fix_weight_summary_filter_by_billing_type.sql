-- ============================================================================
-- 修复计重统计：按 billing_type_id 区分统计
-- 日期：2025-12-02
-- 问题：计重合计（totalWeightLoading/totalWeightUnloading）没有按 billing_type_id 过滤
--      导致计车（billing_type_id=2）、计体积（billing_type_id=3）、计件（billing_type_id=4）
--      的记录也被计入重量统计
-- 解决：只统计 billing_type_id = 1（计重）的记录
-- 函数后缀：_1201（2025-12-01版本）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced_1201(
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
    p_receipt_status text DEFAULT NULL::text,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 25,
    p_sort_field text DEFAULT 'auto_number'::text,
    p_sort_direction text DEFAULT 'desc'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_offset integer;
    v_result jsonb;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;
    
    IF p_project_name IS NOT NULL AND p_project_name != '' THEN
        v_project_array := regexp_split_to_array(trim(p_project_name), '[,\\s]+');
        v_project_array := array_remove(v_project_array, '');
    END IF;

    WITH filtered_records AS (
        SELECT lr.*,
               pc.chain_name,
               CASE 
                   WHEN EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number) 
                   THEN true 
                   ELSE false 
               END as has_scale_record
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            (v_project_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_project_array) AS project_name
                 WHERE lr.project_name = project_name
             )) AND
            (v_driver_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            (v_license_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            (v_phone_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            (v_waybill_array IS NULL OR 
             EXISTS (
               SELECT 1 FROM unnest(v_waybill_array) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             )) AND
            (p_has_scale_record IS NULL OR p_has_scale_record = '' OR
             CASE 
                 WHEN p_has_scale_record = 'yes' THEN 
                     EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 WHEN p_has_scale_record = 'no' THEN 
                     NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 ELSE true
             END) AND
            -- 新增：开票状态筛选
            (p_invoice_status IS NULL OR p_invoice_status = '' OR lr.invoice_status = p_invoice_status) AND
            -- 新增：付款状态筛选
            (p_payment_status IS NULL OR p_payment_status = '' OR lr.payment_status = p_payment_status) AND
            -- 新增：收款状态筛选
            (p_receipt_status IS NULL OR p_receipt_status = '' OR lr.receipt_status = p_receipt_status)
    ),
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_records
    ),
    summary AS (
        SELECT 
            COALESCE(SUM(CASE WHEN lr.transport_type = '实际运输' THEN 1 ELSE 0 END), 0) as actual_count,
            COALESCE(SUM(CASE WHEN lr.transport_type = '退货' THEN 1 ELSE 0 END), 0) as return_count,
            -- ✅ 修复：只统计 billing_type_id = 1（计重）的记录
            COALESCE(SUM(CASE WHEN COALESCE(lr.billing_type_id, 1) = 1 THEN COALESCE(lr.loading_weight, 0) ELSE 0 END), 0) as total_weight_loading,
            COALESCE(SUM(CASE WHEN COALESCE(lr.billing_type_id, 1) = 1 THEN COALESCE(lr.unloading_weight, 0) ELSE 0 END), 0) as total_weight_unloading,
            COALESCE(SUM(COALESCE(lr.current_cost, 0)), 0) as total_current_cost,
            COALESCE(SUM(COALESCE(lr.extra_cost, 0)), 0) as total_extra_cost,
            COALESCE(SUM(COALESCE(lr.payable_cost, 0)), 0) as total_driver_payable_cost,
            COUNT(CASE WHEN COALESCE(lr.billing_type_id, 1) = 2 THEN 1 ELSE NULL END) as total_trips_loading,
            COALESCE(SUM(CASE WHEN COALESCE(lr.billing_type_id, 1) = 3 THEN COALESCE(lr.loading_weight, 0) ELSE 0 END), 0) as total_volume_loading,
            COALESCE(SUM(CASE WHEN COALESCE(lr.billing_type_id, 1) = 3 THEN COALESCE(lr.unloading_weight, 0) ELSE 0 END), 0) as total_volume_unloading,
            COALESCE(SUM(CASE WHEN COALESCE(lr.billing_type_id, 1) = 4 THEN COALESCE(lr.loading_weight, 0) ELSE 0 END), 0) as total_pieces_loading,
            COALESCE(SUM(CASE WHEN COALESCE(lr.billing_type_id, 1) = 4 THEN COALESCE(lr.unloading_weight, 0) ELSE 0 END), 0) as total_pieces_unloading
        FROM public.logistics_records lr
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            (v_project_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_project_array) AS project_name
                 WHERE lr.project_name = project_name
             )) AND
            (v_driver_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            (v_license_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            (v_phone_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            (v_waybill_array IS NULL OR 
             EXISTS (
               SELECT 1 FROM unnest(v_waybill_array) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             )) AND
            (p_has_scale_record IS NULL OR p_has_scale_record = '' OR
             CASE 
                 WHEN p_has_scale_record = 'yes' THEN 
                     EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 WHEN p_has_scale_record = 'no' THEN 
                     NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 ELSE true
             END) AND
            -- 新增：开票状态筛选
            (p_invoice_status IS NULL OR p_invoice_status = '' OR lr.invoice_status = p_invoice_status) AND
            -- 新增：付款状态筛选
            (p_payment_status IS NULL OR p_payment_status = '' OR lr.payment_status = p_payment_status) AND
            -- 新增：收款状态筛选
            (p_receipt_status IS NULL OR p_receipt_status = '' OR lr.receipt_status = p_receipt_status)
    )
    SELECT jsonb_build_object(
        'records', (
            SELECT COALESCE(jsonb_agg(fr.*), '[]'::jsonb)
            FROM (
                SELECT * FROM filtered_records
                ORDER BY 
                    CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN auto_number END ASC,
                    CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN auto_number END DESC,
                    CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN loading_date END ASC,
                    CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN loading_date END DESC,
                    CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'asc' THEN project_name END ASC,
                    CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'desc' THEN project_name END DESC,
                    CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN driver_name END ASC,
                    CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN driver_name END DESC,
                    CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'asc' THEN current_cost END ASC,
                    CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'desc' THEN current_cost END DESC,
                    CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN payable_cost END ASC,
                    CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN payable_cost END DESC,
                    loading_date DESC, created_at DESC
                LIMIT p_page_size OFFSET v_offset
            ) fr
        ),
        'summary', (
            SELECT jsonb_build_object(
                'totalCurrentCost', s.total_current_cost,
                'totalExtraCost', s.total_extra_cost,
                'totalDriverPayableCost', s.total_driver_payable_cost,
                'actualCount', s.actual_count,
                'returnCount', s.return_count,
                'totalWeightLoading', s.total_weight_loading,
                'totalWeightUnloading', s.total_weight_unloading,
                'totalTripsLoading', s.total_trips_loading,
                'totalVolumeLoading', s.total_volume_loading,
                'totalVolumeUnloading', s.total_volume_unloading,
                'totalPiecesLoading', s.total_pieces_loading,
                'totalPiecesUnloading', s.total_pieces_unloading
            )
            FROM summary s
        ),
        'totalCount', (SELECT count FROM total_count)
    ) INTO v_result;
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    -- 错误处理：返回空结构并记录错误
    RAISE WARNING '函数执行出错: %', SQLERRM;
    RETURN jsonb_build_object(
        'records', '[]'::jsonb,
        'summary', jsonb_build_object(
            'totalCurrentCost', 0,
            'totalExtraCost', 0,
            'totalDriverPayableCost', 0,
            'actualCount', 0,
            'returnCount', 0,
            'totalWeightLoading', 0,
            'totalWeightUnloading', 0,
            'totalTripsLoading', 0,
            'totalVolumeLoading', 0,
            'totalVolumeUnloading', 0,
            'totalPiecesLoading', 0,
            'totalPiecesUnloading', 0
        ),
        'totalCount', 0,
        'error', SQLERRM
    );
END;
$function$;

COMMENT ON FUNCTION public.get_logistics_summary_and_records_enhanced_1201 IS '获取运单汇总和记录（支持状态筛选和计件模式，2025-12-01版本，已修复：计重统计按 billing_type_id 过滤）';

-- 验证
DO $$
DECLARE
    test_result jsonb;
    record_count integer;
    weight_loading numeric;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 统计函数已修复：计重统计按 billing_type_id 过滤';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  • totalWeightLoading: 只统计 billing_type_id = 1（计重）的记录';
    RAISE NOTICE '  • totalWeightUnloading: 只统计 billing_type_id = 1（计重）的记录';
    RAISE NOTICE '  • 计车（billing_type_id=2）、计体积（billing_type_id=3）、计件（billing_type_id=4）不再计入重量统计';
    RAISE NOTICE '';
    RAISE NOTICE '测试函数（不传参数，应该返回所有记录）：';
    SELECT public.get_logistics_summary_and_records_enhanced_1201() INTO test_result;
    record_count := (test_result->>'totalCount')::integer;
    weight_loading := ((test_result->'summary'->>'totalWeightLoading')::numeric);
    RAISE NOTICE '  总记录数: %', record_count;
    RAISE NOTICE '  计重合计（装）: % 吨', weight_loading;
    IF record_count > 0 THEN
        RAISE NOTICE '  ✅ 函数正常工作，返回了 % 条记录', record_count;
    ELSE
        RAISE NOTICE '  ⚠️  函数返回0条记录，请检查数据库是否有运单数据';
    END IF;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

