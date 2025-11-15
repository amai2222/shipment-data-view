-- ============================================================================
-- 添加项目名称批量筛选功能（支持逗号分隔的多个项目名称）
-- 修改日期：2025-11-15
-- 
-- 修改目标：
-- 1. 支持 p_project_name 参数接收多个项目名称（逗号分隔）
-- 2. 使用 OR 逻辑进行批量筛选
-- 3. 函数使用_1115后缀
-- ============================================================================

-- ============================================================================
-- 1. get_logistics_summary_and_records_enhanced_1115
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced_1115(
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_project_name text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_has_scale_record text DEFAULT NULL::text, 
    p_page_number integer DEFAULT 1, 
    p_page_size integer DEFAULT 25, 
    p_sort_field text DEFAULT 'auto_number'::text, 
    p_sort_direction text DEFAULT 'desc'::text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_offset integer;
    v_result jsonb;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_array text[]; -- ✅ 新增：项目名称数组
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
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
    
    -- ✅ 新增：解析项目名称（支持批量，逗号分隔）
    IF p_project_name IS NOT NULL AND p_project_name != '' THEN
        v_project_array := regexp_split_to_array(trim(p_project_name), '[,\s]+');
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
            -- ✅ 修改：使用 +08:00 时区转换
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            -- ✅ 修改：项目名称筛选（支持批量，OR逻辑）
            (v_project_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_project_array) AS project_name
                 WHERE lr.project_name = project_name
             )) AND
            -- 司机筛选（支持批量，OR逻辑）
            (v_driver_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            -- 车牌号筛选（支持批量，OR逻辑）
            (v_license_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            -- 电话筛选（支持批量，OR逻辑）
            (v_phone_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            -- 其他平台名称筛选：为空则查询本平台（other_platform_names为空或null），不为空则查询包含该平台名称的记录
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            -- 运单编号筛选（支持批量，同时搜索本平台和其他平台运单号）
            (v_waybill_array IS NULL OR 
             EXISTS (
               SELECT 1 FROM unnest(v_waybill_array) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             )) AND
            -- 磅单筛选
            (p_has_scale_record IS NULL OR p_has_scale_record = '' OR
             CASE 
                 WHEN p_has_scale_record = 'yes' THEN 
                     EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 WHEN p_has_scale_record = 'no' THEN 
                     NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 ELSE true
             END)
        ORDER BY 
            CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN lr.auto_number END ASC,
            CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN lr.auto_number END DESC,
            CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN lr.loading_date END ASC,
            CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN lr.loading_date END DESC,
            CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'asc' THEN lr.project_name END ASC,
            CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'desc' THEN lr.project_name END DESC,
            CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN lr.driver_name END ASC,
            CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN lr.driver_name END DESC,
            CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN lr.payable_cost END ASC,
            CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN lr.payable_cost END DESC
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(*) as count
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            -- ✅ 修改：使用 +08:00 时区转换
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            -- ✅ 修改：项目名称筛选（支持批量，OR逻辑）
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
             END)
    ),
    summary AS (
        SELECT 
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN 1 ELSE 0 END), 0) as actual_count,
            COALESCE(SUM(CASE WHEN lr.record_type = '退货' THEN 1 ELSE 0 END), 0) as return_count,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.loading_weight, 0) ELSE 0 END), 0) as total_weight_loading,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.unloading_weight, 0) ELSE 0 END), 0) as total_weight_unloading,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.current_cost, 0) ELSE 0 END), 0) as total_current_cost,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.extra_cost, 0) ELSE 0 END), 0) as total_extra_cost,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.payable_cost, 0) ELSE 0 END), 0) as total_driver_payable_cost,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.trips_loading, 0) ELSE 0 END), 0) as total_trips_loading,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.volume_loading, 0) ELSE 0 END), 0) as total_volume_loading,
            COALESCE(SUM(CASE WHEN lr.record_type = '实际' THEN COALESCE(lr.volume_unloading, 0) ELSE 0 END), 0) as total_volume_unloading
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            -- ✅ 修改：使用 +08:00 时区转换
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            -- ✅ 修改：项目名称筛选（支持批量，OR逻辑）
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
             END)
    )
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', fr.id,
                'auto_number', fr.auto_number,
                'project_id', fr.project_id,
                'project_name', fr.project_name,
                'driver_id', fr.driver_id,
                'driver_name', fr.driver_name,
                'license_plate', fr.license_plate,
                'driver_phone', fr.driver_phone,
                'loading_date', fr.loading_date,
                'unloading_date', fr.unloading_date,
                'loading_address', fr.loading_address,
                'unloading_address', fr.unloading_address,
                'loading_weight', fr.loading_weight,
                'unloading_weight', fr.unloading_weight,
                'current_cost', fr.current_cost,
                'extra_cost', fr.extra_cost,
                'payable_cost', fr.payable_cost,
                'record_type', fr.record_type,
                'payment_status', fr.payment_status,
                'chain_id', fr.chain_id,
                'chain_name', fr.chain_name,
                'other_platform_names', fr.other_platform_names,
                'external_tracking_numbers', fr.external_tracking_numbers,
                'has_scale_record', fr.has_scale_record,
                'trips_loading', fr.trips_loading,
                'volume_loading', fr.volume_loading,
                'volume_unloading', fr.volume_unloading
            )
            ORDER BY 
                CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN fr.auto_number END ASC,
                CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN fr.auto_number END DESC,
                CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN fr.loading_date END ASC,
                CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN fr.loading_date END DESC,
                CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'asc' THEN fr.project_name END ASC,
                CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'desc' THEN fr.project_name END DESC,
                CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN fr.driver_name END ASC,
                CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN fr.driver_name END DESC,
                CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN fr.payable_cost END ASC,
                CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN fr.payable_cost END DESC
        ), '[]'::jsonb),
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
                'totalVolumeUnloading', s.total_volume_unloading
            )
            FROM summary s
        ),
        'totalCount', (SELECT count FROM total_count)
    ) INTO v_result
    FROM filtered_records fr;
    
    RETURN v_result;
END;
$function$;

-- ============================================================================
-- 2. get_all_filtered_record_ids_1115
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids_1115(
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_project_name text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_has_scale_record text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_array text[]; -- ✅ 新增：项目名称数组
BEGIN
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
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
    
    -- ✅ 新增：解析项目名称（支持批量，逗号分隔）
    IF p_project_name IS NOT NULL AND p_project_name != '' THEN
        v_project_array := regexp_split_to_array(trim(p_project_name), '[,\s]+');
        v_project_array := array_remove(v_project_array, '');
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'recordIds', (
                SELECT COALESCE(jsonb_agg(lr.id::text), '[]'::jsonb)
                FROM public.logistics_records lr
                WHERE
                    -- ✅ 修改：使用 +08:00 时区转换
                    (p_start_date IS NULL OR p_start_date = '' OR 
                     lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
                    (p_end_date IS NULL OR p_end_date = '' OR 
                     lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
                    -- ✅ 修改：项目名称筛选（支持批量，OR逻辑）
                    (v_project_array IS NULL OR 
                     EXISTS (
                         SELECT 1 FROM unnest(v_project_array) AS project_name
                         WHERE lr.project_name = project_name
                     )) AND
                    -- 司机筛选（支持批量，OR逻辑）
                    (v_driver_array IS NULL OR 
                     EXISTS (
                         SELECT 1 FROM unnest(v_driver_array) AS driver_name
                         WHERE lr.driver_name ILIKE '%' || driver_name || '%'
                     )) AND
                    -- 车牌号筛选（支持批量，OR逻辑）
                    (v_license_array IS NULL OR 
                     EXISTS (
                         SELECT 1 FROM unnest(v_license_array) AS plate
                         WHERE lr.license_plate ILIKE '%' || plate || '%'
                     )) AND
                    -- 电话筛选（支持批量，OR逻辑）
                    (v_phone_array IS NULL OR 
                     EXISTS (
                         SELECT 1 FROM unnest(v_phone_array) AS phone
                         WHERE lr.driver_phone ILIKE '%' || phone || '%'
                     )) AND
                    -- 其他平台名称筛选：为空则查询本平台（other_platform_names为空或null），不为空则查询包含该平台名称的记录
                    (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
                     CASE 
                         WHEN p_other_platform_name = '本平台' THEN 
                             (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                         ELSE 
                             EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                                    WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
                     END) AND
                    -- 运单编号筛选（支持批量，同时搜索本平台和其他平台运单号）
                    (v_waybill_array IS NULL OR 
                     EXISTS (
                       SELECT 1 FROM unnest(v_waybill_array) AS wb_num
                       WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                          OR EXISTS (
                               SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                               WHERE ext_num ILIKE '%' || wb_num || '%'
                             )
                     )) AND
                    -- 磅单筛选
                    (p_has_scale_record IS NULL OR p_has_scale_record = '' OR
                     CASE 
                         WHEN p_has_scale_record = 'yes' THEN 
                             EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                         WHEN p_has_scale_record = 'no' THEN 
                             NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                         ELSE true
                     END)
            ),
            'totalCount', (SELECT COUNT(*) FROM public.logistics_records lr
                WHERE
                    -- ✅ 修改：使用 +08:00 时区转换
                    (p_start_date IS NULL OR p_start_date = '' OR 
                     lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
                    (p_end_date IS NULL OR p_end_date = '' OR 
                     lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
                    -- ✅ 修改：项目名称筛选（支持批量，OR逻辑）
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
                     END)
            ),
            'summary', (
                SELECT jsonb_build_object(
                    'projectNames', COALESCE(jsonb_agg(DISTINCT lr.project_name), '[]'::jsonb),
                    'driverNames', COALESCE(jsonb_agg(DISTINCT lr.driver_name), '[]'::jsonb),
                    'dateRange', jsonb_build_object(
                        'earliest', COALESCE(MIN(lr.loading_date)::text, ''),
                        'latest', COALESCE(MAX(lr.loading_date)::text, '')
                    )
                )
                FROM public.logistics_records lr
                WHERE
                    -- ✅ 修改：使用 +08:00 时区转换
                    (p_start_date IS NULL OR p_start_date = '' OR 
                     lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
                    (p_end_date IS NULL OR p_end_date = '' OR 
                     lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
                    -- ✅ 修改：项目名称筛选（支持批量，OR逻辑）
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
                     END)
            )
        )
    );
END;
$function$;

