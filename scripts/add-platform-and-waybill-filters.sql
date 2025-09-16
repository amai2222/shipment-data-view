-- 更新get_logistics_summary_and_records函数，添加其他平台名称和运单编号筛选
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
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
               pc.chain_name
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
            -- 运单编号筛选：支持多个运单编号查询
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array))
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
