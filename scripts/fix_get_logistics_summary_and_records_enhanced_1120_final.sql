-- ============================================================================
-- 最终修复 get_logistics_summary_and_records_enhanced_1120 函数
-- 确保所有字段引用都正确，处理可能不存在的字段
-- ============================================================================

-- 删除旧版本
DROP FUNCTION IF EXISTS public.get_logistics_summary_and_records_enhanced_1120();

-- 创建新函数（安全版本）
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced_1120(
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_offset integer;
    v_result JSONB;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析批量输入参数
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

    WITH filtered_records AS (
        SELECT 
            lr.id,
            lr.auto_number,
            lr.project_id,
            lr.project_name,
            lr.chain_id,
            COALESCE(pc.chain_name, '') as chain_name,
            COALESCE(lr.billing_type_id, 1) as billing_type_id,
            lr.driver_id,
            lr.driver_name,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.unloading_date,
            lr.loading_weight,
            lr.unloading_weight,
            lr.current_cost,
            lr.payable_cost,
            lr.license_plate,
            lr.driver_phone,
            lr.transport_type,
            lr.extra_cost,
            lr.remarks,
            -- 使用 COALESCE 处理可能不存在的字段
            COALESCE(lr.loading_weighbridge_image_url, NULL) as loading_weighbridge_image_url,
            COALESCE(lr.unloading_weighbridge_image_url, NULL) as unloading_weighbridge_image_url,
            COALESCE(lr.external_tracking_numbers, '{}'::text[]) as external_tracking_numbers,
            COALESCE(lr.other_platform_names, '{}'::text[]) as other_platform_names,
            lr.created_at,
            lr.created_by_user_id,
            COALESCE(lr.invoice_status, 'Uninvoiced') as invoice_status,
            COALESCE(lr.payment_status, 'Unpaid') as payment_status,
            COALESCE(lr.receipt_status, 'Unreceived') as receipt_status,
            lr.unit_price,
            lr.effective_quantity,
            lr.calculation_mode
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            (v_driver_array IS NULL OR lr.driver_name = ANY(v_driver_array)) AND
            (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array)) AND
            (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array)) AND
            (p_other_platform_name IS NULL OR 
             p_other_platform_name = '' OR 
             p_other_platform_name = ANY(COALESCE(lr.other_platform_names, '{}'::text[]))) AND
            (v_waybill_array IS NULL OR 
             EXISTS (
                SELECT 1 
                FROM unnest(COALESCE(lr.external_tracking_numbers, '{}'::text[])) AS etn 
                WHERE etn = ANY(v_waybill_array)
             ) OR
             lr.auto_number = ANY(v_waybill_array)) AND
            (p_has_scale_record IS NULL OR 
             p_has_scale_record = '' OR
             CASE 
                WHEN p_has_scale_record = '有磅单' THEN 
                    (COALESCE(lr.loading_weighbridge_image_url, '') != '' OR COALESCE(lr.unloading_weighbridge_image_url, '') != '')
                WHEN p_has_scale_record = '无磅单' THEN 
                    (COALESCE(lr.loading_weighbridge_image_url, '') = '' AND COALESCE(lr.unloading_weighbridge_image_url, '') = '')
                ELSE true
             END) AND
            (p_invoice_status IS NULL OR p_invoice_status = '' OR COALESCE(lr.invoice_status, 'Uninvoiced') = p_invoice_status) AND
            (p_payment_status IS NULL OR p_payment_status = '' OR COALESCE(lr.payment_status, 'Unpaid') = p_payment_status) AND
            (p_receipt_status IS NULL OR p_receipt_status = '' OR COALESCE(lr.receipt_status, 'Unreceived') = p_receipt_status)
    ),
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_records
    ),
    summary AS (
        SELECT 
            COALESCE(SUM(CASE WHEN lr.transport_type = '实际运输' THEN 1 ELSE 0 END), 0) as actual_count,
            COALESCE(SUM(CASE WHEN lr.transport_type = '退货' THEN 1 ELSE 0 END), 0) as return_count,
            COALESCE(SUM(COALESCE(lr.loading_weight, 0)), 0) as total_weight_loading,
            COALESCE(SUM(COALESCE(lr.unloading_weight, 0)), 0) as total_weight_unloading,
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
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            (v_driver_array IS NULL OR lr.driver_name = ANY(v_driver_array)) AND
            (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array)) AND
            (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array)) AND
            (p_other_platform_name IS NULL OR 
             p_other_platform_name = '' OR 
             p_other_platform_name = ANY(COALESCE(lr.other_platform_names, '{}'::text[]))) AND
            (v_waybill_array IS NULL OR 
             EXISTS (
                SELECT 1 
                FROM unnest(COALESCE(lr.external_tracking_numbers, '{}'::text[])) AS etn 
                WHERE etn = ANY(v_waybill_array)
             ) OR
             lr.auto_number = ANY(v_waybill_array)) AND
            (p_has_scale_record IS NULL OR 
             p_has_scale_record = '' OR
             CASE 
                WHEN p_has_scale_record = '有磅单' THEN 
                    (COALESCE(lr.loading_weighbridge_image_url, '') != '' OR COALESCE(lr.unloading_weighbridge_image_url, '') != '')
                WHEN p_has_scale_record = '无磅单' THEN 
                    (COALESCE(lr.loading_weighbridge_image_url, '') = '' AND COALESCE(lr.unloading_weighbridge_image_url, '') = '')
                ELSE true
             END) AND
            (p_invoice_status IS NULL OR p_invoice_status = '' OR COALESCE(lr.invoice_status, 'Uninvoiced') = p_invoice_status) AND
            (p_payment_status IS NULL OR p_payment_status = '' OR COALESCE(lr.payment_status, 'Unpaid') = p_payment_status) AND
            (p_receipt_status IS NULL OR p_receipt_status = '' OR COALESCE(lr.receipt_status, 'Unreceived') = p_receipt_status)
    )
    SELECT jsonb_build_object(
        'records', (
            SELECT COALESCE(jsonb_agg(fr.* ORDER BY 
                CASE 
                    WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN fr.auto_number 
                END ASC,
                CASE 
                    WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN fr.auto_number 
                END DESC,
                CASE 
                    WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN fr.loading_date 
                END ASC,
                CASE 
                    WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN fr.loading_date 
                END DESC,
                CASE 
                    WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN fr.payable_cost 
                END ASC,
                CASE 
                    WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN fr.payable_cost 
                END DESC
            ), '[]'::jsonb)
            FROM (
                SELECT * FROM filtered_records
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

COMMENT ON FUNCTION public.get_logistics_summary_and_records_enhanced_1120 IS 
'获取运单汇总和记录（支持状态筛选和计件模式，2025-11-20版本）
修复内容：
1. 添加 LEFT JOIN partner_chains 获取 chain_name
2. 使用 COALESCE 处理可能为 NULL 的字段
3. 添加错误处理机制';

-- 测试函数
DO $$
DECLARE
    test_result JSONB;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始测试函数 get_logistics_summary_and_records_enhanced_1120...';
    RAISE NOTICE '========================================';
    
    -- 执行函数（不传参数，使用默认值）
    SELECT public.get_logistics_summary_and_records_enhanced_1120() INTO test_result;
    
    -- 检查返回结构
    IF test_result ? 'records' AND test_result ? 'summary' AND test_result ? 'totalCount' THEN
        RAISE NOTICE '✅ 函数执行成功！';
        RAISE NOTICE '✅ 返回结构正确（包含 records, summary, totalCount）';
        RAISE NOTICE '✅ 记录数量: %', test_result->>'totalCount';
        
        IF (test_result->>'totalCount')::integer > 0 THEN
            RAISE NOTICE '✅ 有运单数据';
        ELSE
            RAISE NOTICE '⚠️  运单数量为0，可能是数据库中没有运单数据';
        END IF;
    ELSE
        RAISE NOTICE '❌ 函数返回结构不正确';
        RAISE NOTICE '返回内容: %', test_result;
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

