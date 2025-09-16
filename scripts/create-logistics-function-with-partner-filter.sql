-- 创建支持合作商筛选的增强版运单查询函数
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_with_partner(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_partner_id text DEFAULT NULL, -- 新增：合作商ID筛选
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
        -- 新增：合作商筛选逻辑（只筛选最高级别合作商）
        LEFT JOIN public.project_partners pp ON lr.project_id = pp.project_id AND pp.level = 1
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
            -- 新增：合作商筛选条件
            (p_partner_id IS NULL OR p_partner_id = '' OR pp.partner_id = p_partner_id::uuid) AND
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
             lr.auto_number = ANY(v_waybill_array)) AND
            -- 磅单筛选：根据是否有磅单进行筛选
            (p_has_scale_record IS NULL OR p_has_scale_record = '' OR
             CASE 
                 WHEN p_has_scale_record = 'yes' THEN 
                     EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 WHEN p_has_scale_record = 'no' THEN 
                     NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 ELSE true
             END)
    ),
    -- 计算总数
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_records
    ),
    -- 分页记录
    paginated_records AS (
        SELECT * FROM filtered_records
        ORDER BY 
            CASE WHEN p_sort_direction = 'asc' THEN
                CASE p_sort_field
                    WHEN 'auto_number' THEN auto_number
                    WHEN 'project_name' THEN project_name
                    WHEN 'driver_name' THEN driver_name
                    WHEN 'loading_date' THEN loading_date::text
                    WHEN 'current_cost' THEN current_cost::text
                    WHEN 'payable_cost' THEN payable_cost::text
                    ELSE auto_number
                END
            END ASC,
            CASE WHEN p_sort_direction = 'desc' THEN
                CASE p_sort_field
                    WHEN 'auto_number' THEN auto_number
                    WHEN 'project_name' THEN project_name
                    WHEN 'driver_name' THEN driver_name
                    WHEN 'loading_date' THEN loading_date::text
                    WHEN 'current_cost' THEN current_cost::text
                    WHEN 'payable_cost' THEN payable_cost::text
                    ELSE auto_number
                END
            END DESC
        LIMIT p_page_size OFFSET v_offset
    ),
    -- 计算汇总统计
    summary_stats AS (
        SELECT 
            COUNT(*) as total_count,
            COUNT(CASE WHEN transport_type = '实际运输' THEN 1 END) as actual_transport_count,
            COUNT(CASE WHEN transport_type = '退货' THEN 1 END) as return_count,
            COALESCE(SUM(current_cost), 0) as total_current_cost,
            COALESCE(SUM(extra_cost), 0) as total_extra_cost,
            COALESCE(SUM(payable_cost), 0) as total_payable_cost,
            COALESCE(SUM(loading_weight), 0) as total_loading_weight,
            COALESCE(SUM(unloading_weight), 0) as total_unloading_weight,
            COUNT(CASE WHEN billing_type_id = 2 THEN 1 END) as trip_count
        FROM filtered_records
    )
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', id,
                'auto_number', auto_number,
                'project_id', project_id,
                'project_name', project_name,
                'chain_id', chain_id,
                'chain_name', chain_name,
                'billing_type_id', billing_type_id,
                'driver_id', driver_id,
                'driver_name', driver_name,
                'loading_location', loading_location,
                'unloading_location', unloading_location,
                'loading_date', loading_date,
                'unloading_date', unloading_date,
                'loading_weight', loading_weight,
                'unloading_weight', unloading_weight,
                'current_cost', current_cost,
                'payable_cost', payable_cost,
                'driver_payable_cost', driver_payable_cost,
                'license_plate', license_plate,
                'driver_phone', driver_phone,
                'transport_type', transport_type,
                'extra_cost', extra_cost,
                'remarks', remarks,
                'loading_weighbridge_image_url', loading_weighbridge_image_url,
                'unloading_weighbridge_image_url', unloading_weighbridge_image_url,
                'external_tracking_numbers', external_tracking_numbers,
                'other_platform_names', other_platform_names,
                'created_at', created_at,
                'has_scale_record', has_scale_record
            )
        ), '[]'::jsonb),
        'totalCount', (SELECT count FROM total_count),
        'summary', (
            SELECT jsonb_build_object(
                'totalCount', total_count,
                'actualTransportCount', actual_transport_count,
                'returnCount', return_count,
                'totalCurrentCost', total_current_cost,
                'totalExtraCost', total_extra_cost,
                'totalPayableCost', total_payable_cost,
                'totalLoadingWeight', total_loading_weight,
                'totalUnloadingWeight', total_unloading_weight,
                'tripCount', trip_count
            )
            FROM summary_stats
        )
    ) INTO v_result
    FROM paginated_records;

    RETURN v_result;
END;
$$;
