-- ============================================================================
-- 统一日期筛选逻辑并重命名函数（添加_1113后缀）
-- 修改日期：2025-11-13
-- 
-- 修改目标：
-- 1. 前端传递中国时区日期字符串（如 "2025-11-01"）
-- 2. 后端明确转换为 +08:00 时区进行比较
-- 3. 所有函数重命名为 原函数名_1113
-- ============================================================================

-- ============================================================================
-- 1. get_logistics_summary_and_records_enhanced_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced_1113(
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
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
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
            -- 其他平台名称筛选
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
    )
    SELECT jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'totalCurrentCost', COALESCE(SUM(current_cost), 0),
                'totalExtraCost', COALESCE(SUM(extra_cost), 0),
                'totalDriverPayableCost', COALESCE(SUM(payable_cost), 0),
                'actualCount', COUNT(*) FILTER (WHERE transport_type = '实际运输'),
                'returnCount', COUNT(*) FILTER (WHERE transport_type = '退货'),
                'totalWeightLoading', COALESCE(SUM(loading_weight), 0),
                'totalWeightUnloading', COALESCE(SUM(unloading_weight), 0),
                'totalTripsLoading', COUNT(*) FILTER (WHERE billing_type_id = 2),
                'totalVolumeLoading', COALESCE(SUM(loading_weight) FILTER (WHERE billing_type_id = 3), 0),
                'totalVolumeUnloading', COALESCE(SUM(unloading_weight) FILTER (WHERE billing_type_id = 3), 0)
            )
            FROM filtered_records
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(fr.* ORDER BY 
                CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN fr.auto_number END ASC,
                CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN fr.auto_number END DESC,
                CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN fr.loading_date END ASC,
                CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN fr.loading_date END DESC,
                CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN fr.driver_name END ASC,
                CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN fr.driver_name END DESC,
                CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'asc' THEN fr.current_cost END ASC,
                CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'desc' THEN fr.current_cost END DESC,
                CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN fr.payable_cost END ASC,
                CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN fr.payable_cost END DESC,
                fr.loading_date DESC, fr.created_at DESC
            ), '[]'::jsonb)
            FROM (
                SELECT *
                FROM filtered_records
                ORDER BY 
                    CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN auto_number END ASC,
                    CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN auto_number END DESC,
                    CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN loading_date END ASC,
                    CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN loading_date END DESC,
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
        'totalCount', (
            SELECT COUNT(*)
            FROM filtered_records
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$function$;

-- ============================================================================
-- 2. get_all_filtered_record_ids_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids_1113(
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
                    (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
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
                    -- 其他平台名称筛选
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
                    (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
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
                    (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
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

-- ============================================================================
-- 3. get_dashboard_stats_with_billing_types_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_with_billing_types_1113(
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_project_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    result jsonb;
BEGIN
    WITH filtered_records AS (
        SELECT 
            lr.*,
            COALESCE(lr.billing_type_id, 1) as billing_type
        FROM logistics_records lr
        WHERE 
            -- ✅ 修改：使用 +08:00 时区转换
            (p_start_date IS NULL OR p_start_date = '' OR 
             lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz) AND
            (p_end_date IS NULL OR p_end_date = '' OR 
             lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')) AND
            (p_project_id IS NULL OR lr.project_id = p_project_id)
    )
    SELECT jsonb_build_object(
        'overview', (
            SELECT jsonb_build_object(
                'totalRecords', COUNT(*),
                'totalWeight', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 1 THEN COALESCE(unloading_weight, loading_weight, 0)
                        ELSE 0 
                    END
                ), 0),
                'totalVolume', COALESCE(SUM(
                    CASE 
                        WHEN billing_type = 3 THEN COALESCE(loading_weight, 0)
                        ELSE 0 
                    END
                ), 0),
                'totalTrips', COUNT(
                    CASE 
                        WHEN billing_type = 2 THEN 1
                        ELSE NULL 
                    END
                ),
                'totalCost', COALESCE(SUM(payable_cost), 0),
                'actualTransportCount', COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END),
                'returnCount', COUNT(CASE WHEN transport_type = '退货' THEN 1 END),
                'weightRecordsCount', COUNT(CASE WHEN billing_type = 1 THEN 1 END),
                'tripRecordsCount', COUNT(CASE WHEN billing_type = 2 THEN 1 END),
                'volumeRecordsCount', COUNT(CASE WHEN billing_type = 3 THEN 1 END)
            )
            FROM filtered_records
        ),
        'dailyTransportStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'actualTransport', COALESCE(stats.actual_transport, 0),
                    'returns', COALESCE(stats.returns, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(
                (p_start_date || ' 00:00:00+08:00')::timestamptz::date,
                (p_end_date || ' 23:59:59+08:00')::timestamptz::date,
                '1 day'::interval
            ) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date AT TIME ZONE 'Asia/Shanghai') as loading_date_only,
                    SUM(
                        CASE 
                            WHEN billing_type = 1 AND transport_type = '实际运输' 
                            THEN COALESCE(unloading_weight, loading_weight, 0)
                            ELSE 0 
                        END
                    ) as actual_transport,
                    SUM(
                        CASE 
                            WHEN billing_type = 1 AND transport_type = '退货' 
                            THEN COALESCE(unloading_weight, loading_weight, 0)
                            ELSE 0 
                        END
                    ) as returns
                FROM filtered_records 
                WHERE billing_type = 1
                GROUP BY DATE(loading_date AT TIME ZONE 'Asia/Shanghai')
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyTripStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'actualTransport', COALESCE(stats.actual_transport, 0),
                    'returns', COALESCE(stats.returns, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(
                (p_start_date || ' 00:00:00+08:00')::timestamptz::date,
                (p_end_date || ' 23:59:59+08:00')::timestamptz::date,
                '1 day'::interval
            ) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date AT TIME ZONE 'Asia/Shanghai') as loading_date_only,
                    COUNT(
                        CASE 
                            WHEN billing_type = 2 AND transport_type = '实际运输' 
                            THEN 1 
                            ELSE NULL 
                        END
                    ) as actual_transport,
                    COUNT(
                        CASE 
                            WHEN billing_type = 2 AND transport_type = '退货' 
                            THEN 1 
                            ELSE NULL 
                        END
                    ) as returns
                FROM filtered_records 
                WHERE billing_type = 2
                GROUP BY DATE(loading_date AT TIME ZONE 'Asia/Shanghai')
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyVolumeStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'actualTransport', COALESCE(stats.actual_transport, 0),
                    'returns', COALESCE(stats.returns, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(
                (p_start_date || ' 00:00:00+08:00')::timestamptz::date,
                (p_end_date || ' 23:59:59+08:00')::timestamptz::date,
                '1 day'::interval
            ) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date AT TIME ZONE 'Asia/Shanghai') as loading_date_only,
                    SUM(
                        CASE 
                            WHEN billing_type = 3 AND transport_type = '实际运输' 
                            THEN COALESCE(loading_weight, 0)
                            ELSE 0 
                        END
                    ) as actual_transport,
                    SUM(
                        CASE 
                            WHEN billing_type = 3 AND transport_type = '退货' 
                            THEN COALESCE(loading_weight, 0)
                            ELSE 0 
                        END
                    ) as returns
                FROM filtered_records 
                WHERE billing_type = 3
                GROUP BY DATE(loading_date AT TIME ZONE 'Asia/Shanghai')
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyCostStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'totalCost', COALESCE(stats.total_cost, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(
                (p_start_date || ' 00:00:00+08:00')::timestamptz::date,
                (p_end_date || ' 23:59:59+08:00')::timestamptz::date,
                '1 day'::interval
            ) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date AT TIME ZONE 'Asia/Shanghai') as loading_date_only,
                    SUM(payable_cost) as total_cost
                FROM filtered_records
                GROUP BY DATE(loading_date AT TIME ZONE 'Asia/Shanghai')
            ) stats ON DATE(series_date) = stats.loading_date_only
        ),
        'dailyCountStats', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', to_char(series_date, 'YYYY-MM-DD'),
                    'count', COALESCE(stats.record_count, 0)
                ) ORDER BY series_date
            ), '[]'::jsonb)
            FROM generate_series(
                (p_start_date || ' 00:00:00+08:00')::timestamptz::date,
                (p_end_date || ' 23:59:59+08:00')::timestamptz::date,
                '1 day'::interval
            ) series_date
            LEFT JOIN (
                SELECT 
                    DATE(loading_date AT TIME ZONE 'Asia/Shanghai') as loading_date_only,
                    COUNT(*) as record_count
                FROM filtered_records
                GROUP BY DATE(loading_date AT TIME ZONE 'Asia/Shanghai')
            ) stats ON DATE(series_date) = stats.loading_date_only
        )
    )
    INTO result;

    RETURN result;
END;
$function$;

-- ============================================================================
-- 4. get_invoice_request_data_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_invoice_request_data_1113(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
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
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析批量输入
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

    WITH filtered_records AS (
        SELECT DISTINCT
            lr.*,
            pc.chain_name
        FROM logistics_records lr
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE 1=1
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            -- ✅ 修改：使用 +08:00 时区转换
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array))
            AND (p_driver_receivable IS NULL OR 
                (p_driver_receivable = '>0' AND lr.payable_cost > 0) OR
                (p_driver_receivable = '=0' AND (lr.payable_cost IS NULL OR lr.payable_cost = 0)) OR
                (p_driver_receivable = '<0' AND lr.payable_cost < 0)
            )
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
        ORDER BY lr.auto_number DESC
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_invoiceable_cost AS (
        SELECT COALESCE(SUM(payable_cost), 0) AS total FROM filtered_records
    )
    SELECT json_build_object(
        'overview', json_build_object(
            'total_invoiceable_cost', (SELECT total FROM total_invoiceable_cost)
        ),
        'partners', (
            SELECT COALESCE(json_agg(t), '[]'::json) FROM (
                SELECT 
                    lpc.partner_id, 
                    p.name AS partner_name, 
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM logistics_partner_costs lpc
                JOIN partners p ON lpc.partner_id = p.id
                JOIN filtered_records fr ON lpc.logistics_record_id = fr.id
                WHERE (
                    p_invoice_status_array IS NULL
                    OR (
                      CASE 
                        WHEN 'Uninvoiced' = ANY(p_invoice_status_array) THEN lpc.invoice_status = 'Uninvoiced'
                        WHEN 'Processing' = ANY(p_invoice_status_array) THEN lpc.invoice_status = 'Processing'
                        WHEN 'Invoiced' = ANY(p_invoice_status_array) THEN lpc.invoice_status = 'Invoiced'
                        ELSE lpc.invoice_status = 'Uninvoiced'
                      END
                    )
                  )
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', r.id,
                    'auto_number', r.auto_number,
                    'project_name', r.project_name,
                    'driver_name', r.driver_name,
                    'loading_location', r.loading_location,
                    'unloading_location', r.unloading_location,
                    'loading_date', r.loading_date,
                    'unloading_date', r.unloading_date,
                    'license_plate', r.license_plate,
                    'driver_phone', r.driver_phone,
                    'payable_cost', r.payable_cost,
                    'payment_status', r.payment_status,
                    'invoice_status', r.invoice_status,
                    'cargo_type', r.cargo_type,
                    'loading_weight', r.loading_weight,
                    'unloading_weight', r.unloading_weight,
                    'remarks', r.remarks,
                    'chain_name', r.chain_name,
                    'chain_id', r.chain_id,
                    'partner_costs', (
                        SELECT COALESCE(json_agg(
                            json_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', p.name,
                                'level', lpc.level,
                                'payable_amount', lpc.payable_amount,
                                'payment_status', lpc.payment_status,
                                'invoice_status', lpc.invoice_status,
                                'full_name', p.full_name,
                                'bank_account', pbd.bank_account,
                                'bank_name', pbd.bank_name,
                                'branch_name', pbd.branch_name
                            ) ORDER BY lpc.level
                        ), '[]'::json)
                        FROM logistics_partner_costs lpc
                        JOIN partners p ON lpc.partner_id = p.id
                        LEFT JOIN partner_bank_details pbd ON p.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = r.id
                    )
                ) ORDER BY r.auto_number DESC
            )
            FROM filtered_records r
        ), '[]'::json)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- ============================================================================
-- 5. get_payment_request_data_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_payment_request_data_1113(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_payment_status_array text[] DEFAULT NULL::text[], 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
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
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
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

    -- 主查询逻辑
    WITH filtered_records AS (
        SELECT DISTINCT
            lr.*,
            pc.chain_name
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 1=1
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            -- ✅ 修改：使用 +08:00 时区转换
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_payment_status_array IS NULL OR lr.payment_status = ANY(p_payment_status_array))
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
            ORDER BY lr.auto_number DESC
            LIMIT p_page_size
            OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(DISTINCT lr.id) AS count
        FROM public.logistics_records lr
        WHERE 1=1
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            -- ✅ 修改：使用 +08:00 时区转换
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_payment_status_array IS NULL OR lr.payment_status = ANY(p_payment_status_array))
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
    ),
    total_payable_cost AS (
        SELECT COALESCE(SUM(payable_cost), 0) AS total FROM filtered_records
    )
    SELECT jsonb_build_object(
        'count', (SELECT count FROM total_count),
        'overview', jsonb_build_object(
            'total_payable_cost', (SELECT total FROM total_payable_cost)
        ),
        'partners', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT 
                    lpc.partner_id, 
                    p.name AS partner_name, 
                    p.full_name, 
                    pbd.bank_account, 
                    pbd.bank_name, 
                    pbd.branch_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                  AND (
                    p_payment_status_array IS NULL
                    OR (
                      CASE 
                        WHEN 'Unpaid' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Unpaid'
                        WHEN 'Processing' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Processing'
                        WHEN 'Paid' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Paid'
                        ELSE lpc.payment_status = 'Unpaid'
                      END
                    )
                  )
                GROUP BY lpc.partner_id, p.name, p.full_name, pbd.bank_account, pbd.bank_name, pbd.branch_name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'auto_number', r.auto_number,
                    'project_name', r.project_name,
                    'driver_name', r.driver_name,
                    'loading_location', r.loading_location,
                    'unloading_location', r.unloading_location,
                    'loading_date', r.loading_date,
                    'unloading_date', r.unloading_date,
                    'license_plate', r.license_plate,
                    'driver_phone', r.driver_phone,
                    'payable_cost', r.payable_cost,
                    'payment_status', r.payment_status,
                    'invoice_status', r.invoice_status,
                    'cargo_type', r.cargo_type,
                    'loading_weight', r.loading_weight,
                    'unloading_weight', r.unloading_weight,
                    'remarks', r.remarks,
                    'chain_name', r.chain_name,
                    'chain_id', r.chain_id,
                    'partner_costs', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', p.name,
                                'level', lpc.level,
                                'payable_amount', lpc.payable_amount,
                                'payment_status', lpc.payment_status,
                                'invoice_status', lpc.invoice_status,
                                'full_name', p.full_name,
                                'bank_account', pbd.bank_account,
                                'bank_name', pbd.bank_name,
                                'branch_name', pbd.branch_name
                            ) ORDER BY lpc.level
                        ), '[]'::jsonb)
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners p ON lpc.partner_id = p.id
                        LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = r.id
                    )
                ) ORDER BY r.auto_number DESC
            ), '[]'::jsonb)
            FROM filtered_records r
        )
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- ============================================================================
-- 6. get_payment_requests_filtered_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered_1113(
    p_request_id text DEFAULT NULL::text, 
    p_waybill_number text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_loading_date text DEFAULT NULL::text, 
    p_status text DEFAULT NULL::text, 
    p_project_id text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_phone_number text DEFAULT NULL::text, 
    p_platform_name text DEFAULT NULL::text, 
    p_limit integer DEFAULT 50, 
    p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, created_at timestamp with time zone, request_id text, status text, notes text, logistics_record_ids uuid[], record_count integer, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_total_count BIGINT;
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
BEGIN
    -- 构建基础查询条件（只针对payment_requests表）
    
    -- 申请单号筛选
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.status = %L', p_status));
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL AND p_loading_date != '' OR
       p_project_id IS NOT NULL AND p_project_id != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_phone_number IS NOT NULL AND p_phone_number != '' OR
       p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        
        -- 解析批量输入参数（支持逗号、空格或混合分隔）
        IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
            v_waybill_numbers := regexp_split_to_array(trim(p_waybill_number), '[,\s]+');
            v_waybill_numbers := array_remove(v_waybill_numbers, '');
        END IF;
        
        IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
            v_driver_names := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
            v_driver_names := array_remove(v_driver_names, '');
        END IF;
        
        IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
            v_license_plates := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
            v_license_plates := array_remove(v_license_plates, '');
        END IF;
        
        IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
            v_phone_numbers := regexp_split_to_array(trim(p_phone_number), '[,\s]+');
            v_phone_numbers := array_remove(v_phone_numbers, '');
        END IF;
        
        -- 构建运单筛选条件
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 运单编号筛选（支持批量OR逻辑，查询本平台运单号和其他平台运单号）
            (v_waybill_numbers IS NULL OR 
             EXISTS (
               SELECT 1 FROM unnest(v_waybill_numbers) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             ))
          -- 司机姓名筛选（支持批量OR逻辑）
          AND (v_driver_names IS NULL OR 
               EXISTS (
                 SELECT 1 FROM unnest(v_driver_names) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
               ))
          -- ✅ 修改：装货日期筛选 - 使用 +08:00 时区转换
          AND (p_loading_date IS NULL OR p_loading_date = '' OR 
               (lr.loading_date >= (p_loading_date || ' 00:00:00+08:00')::timestamptz
                AND lr.loading_date < ((p_loading_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')))
          -- 项目筛选
          AND (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::TEXT = p_project_id)
          -- 车牌号筛选（支持批量OR逻辑）
          AND (v_license_plates IS NULL OR 
               EXISTS (
                 SELECT 1 FROM unnest(v_license_plates) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
               ))
          -- 电话号码筛选（支持批量OR逻辑）
          AND (v_phone_numbers IS NULL OR 
               EXISTS (
                 SELECT 1 FROM unnest(v_phone_numbers) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
               ))
          -- 平台名称筛选
          AND (p_platform_name IS NULL OR p_platform_name = '' OR
               CASE 
                 WHEN p_platform_name = '本平台' THEN 
                   (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                   EXISTS (
                     SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name
                     WHERE platform_name ILIKE '%' || p_platform_name || '%'
                   )
               END);
        
        -- 如果有匹配的运单，添加筛选条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('pr.logistics_record_ids && %L', v_logistics_ids));
        ELSE
            -- 如果没有匹配的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                pr.id,
                pr.created_at,
                pr.request_id,
                pr.status,
                pr.notes,
                pr.logistics_record_ids,
                COALESCE(array_length(pr.logistics_record_ids, 1), 0) as record_count
            FROM payment_requests pr
            %s
            ORDER BY pr.created_at DESC
            LIMIT %s OFFSET %s
        ),
        total_count AS (
            SELECT COUNT(*) as count
            FROM payment_requests pr
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_id,
            fr.status,
            fr.notes,
            fr.logistics_record_ids,
            fr.record_count,
            tc.count as total_count
        FROM filtered_requests fr
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$function$;

-- ============================================================================
-- 7. get_invoice_requests_filtered_1113
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered_1113(
    p_request_number text DEFAULT NULL::text, 
    p_waybill_number text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_loading_date text DEFAULT NULL::text, 
    p_status text DEFAULT NULL::text, 
    p_project_id text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_phone_number text DEFAULT NULL::text, 
    p_platform_name text DEFAULT NULL::text, 
    p_limit integer DEFAULT 50, 
    p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, created_at timestamp with time zone, request_number text, invoicing_partner_id uuid, partner_id uuid, partner_name text, partner_full_name text, invoicing_partner_full_name text, invoicing_partner_tax_number text, tax_number text, invoice_number text, total_amount numeric, record_count integer, status text, created_by uuid, remarks text, loading_date_range text, total_payable_cost numeric, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
BEGIN
    -- 构建基础查询条件（针对invoice_requests表）
    
    -- 开票申请单号筛选（支持批量）
    IF p_request_number IS NOT NULL AND p_request_number != '' THEN
        v_waybill_numbers := regexp_split_to_array(trim(p_request_number), '[,\s]+');
        v_waybill_numbers := array_remove(v_waybill_numbers, '');
        
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM unnest(%L::text[]) AS req_num WHERE ir.request_number ILIKE ''%%'' || req_num || ''%%'')', v_waybill_numbers));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.status = %L', p_status));
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL AND p_loading_date != '' OR
       p_project_id IS NOT NULL AND p_project_id != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_phone_number IS NOT NULL AND p_phone_number != '' OR
       p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        
        -- 解析批量输入参数（支持逗号、空格或混合分隔）
        IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
            v_waybill_numbers := regexp_split_to_array(trim(p_waybill_number), '[,\s]+');
            v_waybill_numbers := array_remove(v_waybill_numbers, '');
        END IF;
        
        IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
            v_driver_names := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
            v_driver_names := array_remove(v_driver_names, '');
        END IF;
        
        IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
            v_license_plates := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
            v_license_plates := array_remove(v_license_plates, '');
        END IF;
        
        IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
            v_phone_numbers := regexp_split_to_array(trim(p_phone_number), '[,\s]+');
            v_phone_numbers := array_remove(v_phone_numbers, '');
        END IF;
        
        -- 查询符合条件的logistics_records ID
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 运单编号筛选（支持批量，查询本平台和其他平台运单号）
            (v_waybill_numbers IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_waybill_numbers) AS wb
                 WHERE lr.auto_number ILIKE '%' || wb || '%'
                    OR EXISTS (
                        SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext
                        WHERE ext ILIKE '%' || wb || '%'
                    )
             )) AND
            -- 司机姓名筛选（支持批量）
            (v_driver_names IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_driver_names) AS dr WHERE lr.driver_name ILIKE '%' || dr || '%')) AND
            -- ✅ 修改：装货日期筛选 - 使用 +08:00 时区转换
            (p_loading_date IS NULL OR p_loading_date = '' OR 
             (lr.loading_date >= (p_loading_date || ' 00:00:00+08:00')::timestamptz 
              AND lr.loading_date < ((p_loading_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))) AND
            -- 项目筛选
            (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::text = p_project_id) AND
            -- 车牌号筛选（支持批量）
            (v_license_plates IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_license_plates) AS lp WHERE lr.license_plate ILIKE '%' || lp || '%')) AND
            -- 电话筛选（支持批量）
            (v_phone_numbers IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_phone_numbers) AS ph WHERE lr.driver_phone ILIKE '%' || ph || '%')) AND
            -- 平台筛选
            (p_platform_name IS NULL OR 
             p_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL OR
             EXISTS (
               SELECT 1 FROM unnest(lr.other_platform_names) AS platform
               WHERE platform = p_platform_name
             ));

        -- 如果查询到符合条件的运单ID，添加到WHERE条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('EXISTS (SELECT 1 FROM invoice_request_details ird WHERE ird.invoice_request_id = ir.id AND ird.logistics_record_id = ANY(%L))', v_logistics_ids));
        ELSE
            -- 如果没有匹配的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 合并WHERE条件
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                ir.id,
                ir.created_at,
                ir.request_number,
                ir.invoicing_partner_id,
                ir.partner_id,
                ir.partner_name,
                ir.partner_full_name,
                ir.invoicing_partner_full_name,
                ir.invoicing_partner_tax_number,
                ir.tax_number,
                ir.invoice_number,
                ir.total_amount,
                ir.record_count,
                ir.status,
                ir.created_by,
                ir.remarks
            FROM invoice_requests ir
            %s
            ORDER BY ir.created_at DESC
            LIMIT %s OFFSET %s
        ),
        -- ✅ 新增：计算每个申请单的装货日期范围和司机应收合计
        request_stats AS (
            SELECT 
                fr.id,
                -- 装货日期范围：最早日期 - 最晚日期（转换为中国时区显示）
                CASE 
                    WHEN DATE((MIN(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'') = 
                         DATE((MAX(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'') THEN
                        -- 如果所有运单都是同一天，只显示一个日期（中国时区日期）
                        TO_CHAR((MIN(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'', ''YYYY-MM-DD'')
                    ELSE
                        -- 如果有多个日期，显示范围（中国时区日期）
                        TO_CHAR((MIN(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'', ''YYYY-MM-DD'') || '' ~ '' || 
                        TO_CHAR((MAX(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'', ''YYYY-MM-DD'')
                END AS loading_date_range,
                -- 司机应收合计：所有运单的payable_cost总和
                COALESCE(SUM(lr.payable_cost), 0) AS total_payable_cost
            FROM filtered_requests fr
            INNER JOIN invoice_request_details ird ON ird.invoice_request_id = fr.id
            INNER JOIN logistics_records lr ON lr.id = ird.logistics_record_id
            GROUP BY fr.id
        ),
        total_count AS (
            SELECT COUNT(*) as count
            FROM invoice_requests ir
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_number,
            fr.invoicing_partner_id,
            fr.partner_id,
            fr.partner_name,
            fr.partner_full_name,
            fr.invoicing_partner_full_name,
            fr.invoicing_partner_tax_number,
            fr.tax_number,
            fr.invoice_number,
            fr.total_amount,
            fr.record_count,
            fr.status,
            fr.created_by,
            fr.remarks,
            COALESCE(rs.loading_date_range, ''-'') AS loading_date_range,
            COALESCE(rs.total_payable_cost, 0) AS total_payable_cost,
            tc.count as total_count
        FROM filtered_requests fr
        LEFT JOIN request_stats rs ON rs.id = fr.id
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$function$;

