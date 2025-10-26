-- ============================================================================
-- 修复运单编号搜索：同时搜索本平台和其他平台运单号
-- ============================================================================
-- 问题描述：
-- 当前运单编号搜索只搜索 auto_number 字段（本平台运单号）
-- 无法搜索 external_tracking_numbers 字段（其他平台运单号）
-- 导致其他平台的运单号无法被搜索到
--
-- 修复方案：
-- 在运单编号筛选条件中，同时搜索两个字段：
-- 1. auto_number (本平台运单号)
-- 2. external_tracking_numbers (其他平台运单号数组)
-- ============================================================================
-- 执行日期: 2025-10-26
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
    p_has_scale_record text DEFAULT NULL, -- 'yes': 有磅单, 'no': 无磅单, NULL: 不筛选
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
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析运单编号字符串为数组
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        -- 去除每个元素的前后空格
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
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
            (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%') AND
            (p_license_plate IS NULL OR p_license_plate = '' OR lr.license_plate ILIKE '%' || p_license_plate || '%') AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR lr.driver_phone ILIKE '%' || p_driver_phone || '%') AND
            -- 其他平台名称筛选：为空则查询本平台（other_platform_names为空或null），不为空则查询包含该平台名称的记录
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            -- =====================================================================
            -- 🔍 修复：运单编号筛选 - 同时搜索本平台和其他平台运单号
            -- =====================================================================
            -- 1. 搜索本平台运单号 (auto_number)
            -- 2. 搜索其他平台运单号 (external_tracking_numbers数组)
            -- 使用 && 运算符检查数组是否有交集
            -- =====================================================================
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            -- 磅单筛选：根据是否有磅单进行筛选
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
-- 同时修复 get_all_filtered_record_ids 函数（用于跨页全选）
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
    v_result jsonb;
    v_waybill_array text[];
BEGIN
    -- 解析运单编号字符串为数组
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;

    WITH filtered_records AS (
        SELECT 
            lr.id,
            lr.loading_date
        FROM public.logistics_records lr
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%') AND
            (p_license_plate IS NULL OR p_license_plate = '' OR lr.license_plate ILIKE '%' || p_license_plate || '%') AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR lr.driver_phone ILIKE '%' || p_driver_phone || '%') AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            -- 🔍 同样修复：同时搜索本平台和其他平台运单号
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
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
        'ids', (
            SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
            FROM filtered_records
        ),
        'count', (
            SELECT COUNT(*)
            FROM filtered_records
        ),
        'date_range', (
            SELECT jsonb_build_object(
                'earliest', COALESCE(MIN(loading_date)::text, ''),
                'latest', COALESCE(MAX(loading_date)::text, '')
            )
            FROM filtered_records
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- 修复说明
-- ============================================================================
-- 
-- 修改内容：
-- 1. get_logistics_summary_and_records_enhanced 函数 (第89-91行)
--    - 原逻辑：只搜索 lr.auto_number = ANY(v_waybill_array)
--    - 新逻辑：
--      * lr.auto_number = ANY(v_waybill_array)  -- 搜索本平台运单号
--      * OR lr.external_tracking_numbers && v_waybill_array  -- 搜索其他平台运单号数组
--
-- 2. get_all_filtered_record_ids 函数 (第214-216行)
--    - 同样的修改逻辑
--
-- 数组交集运算符说明：
-- - && 运算符：检查两个数组是否有交集
-- - 例如：ARRAY['a','b'] && ARRAY['b','c'] 返回 true
--
-- 使用场景：
-- - 输入运单号: "2021991438"
-- - 如果是本平台运单号，通过 auto_number 查找
-- - 如果是其他平台运单号，通过 external_tracking_numbers 数组查找
-- - 支持批量搜索：多个运单号用逗号分隔
--
-- ============================================================================
-- 测试查询
-- ============================================================================
-- 
-- -- 测试搜索其他平台运单号
-- SELECT * FROM get_logistics_summary_and_records_enhanced(
--     p_waybill_numbers := '2021991438'
-- );
--
-- -- 测试批量搜索（包含本平台和其他平台）
-- SELECT * FROM get_logistics_summary_and_records_enhanced(
--     p_waybill_numbers := 'HDA0648,2021991438,ABC123'
-- );
--
-- ============================================================================

