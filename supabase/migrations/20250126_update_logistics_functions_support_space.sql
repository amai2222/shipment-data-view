-- ============================================================================
-- 更新运单管理函数，支持逗号和空格分隔
-- 创建日期：2025-01-26
-- 说明：修改运单管理批量查询函数，支持批量输入时使用逗号、空格或混合分隔
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 删除旧版本函数
-- ============================================================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 删除所有get_logistics_summary_and_records_enhanced的重载版本
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_logistics_summary_and_records_enhanced'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', r.func_signature;
    END LOOP;
    
    -- 删除所有get_all_filtered_record_ids的重载版本
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_all_filtered_record_ids'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', r.func_signature;
    END LOOP;
END $$;

-- ============================================================================
-- 2. 创建增强版运单查询函数（支持空格分隔）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_has_scale_record text DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 25,
    p_sort_field text DEFAULT 'auto_number',
    p_sort_direction text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
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
$$;

-- ============================================================================
-- 3. 创建获取所有筛选记录ID函数（支持空格分隔）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_has_scale_record text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
                    (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
                    (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
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
                    (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
                    (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
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
                    (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
                    (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
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
$$;

-- ============================================================================
-- 4. 添加函数注释
-- ============================================================================
COMMENT ON FUNCTION public.get_logistics_summary_and_records_enhanced IS '
运单管理增强查询函数
- 支持批量查询（逗号、空格或混合分隔，OR逻辑）：运单编号、司机姓名、车牌号、电话号码
- 批量输入示例："张三,李四" 或 "张三 李四" 或 "张三, 李四"
- 运单编号查询范围：本平台运单号(auto_number) + 其他平台运单号(external_tracking_numbers)
- 支持平台名称筛选、磅单筛选、排序和分页
';

COMMENT ON FUNCTION public.get_all_filtered_record_ids IS '
获取所有筛选记录ID
- 支持批量查询（逗号、空格或混合分隔，OR逻辑）
- 用于批量操作功能
';

-- ============================================================================
-- 5. 授权
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_logistics_summary_and_records_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_logistics_summary_and_records_enhanced TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_filtered_record_ids TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_filtered_record_ids TO anon;

COMMIT;

-- ============================================================================
-- 测试查询示例
-- ============================================================================

-- 基础查询
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced();

-- 批量司机筛选（支持逗号、空格或混合分隔）
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_driver_name => '张三,李四');
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_driver_name => '张三 李四');
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_driver_name => '张三, 李四, 王五');

-- 批量车牌号筛选
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_license_plate => '京A12345,京B67890');
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_license_plate => '京A12345 京B67890');

-- 批量运单编号筛选
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_waybill_numbers => 'WB001,WB002,WB003');
-- SELECT * FROM public.get_logistics_summary_and_records_enhanced(p_waybill_numbers => 'WB001 WB002 WB003');

-- 测试获取所有筛选记录ID
-- SELECT * FROM public.get_all_filtered_record_ids(p_driver_name => '张三 李四');

