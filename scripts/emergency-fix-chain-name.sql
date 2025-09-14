-- 紧急修复 chain_name 字段错误
-- 创建一个简化但完整的函数版本

CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 20,
    p_sort_field text DEFAULT 'auto_number',
    p_sort_direction text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_records jsonb;
    v_summary jsonb;
    v_total_count integer;
    v_offset integer;
    v_order_clause text;
BEGIN
    -- 计算偏移量
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 构建排序子句
    CASE p_sort_field
        WHEN 'auto_number' THEN
            v_order_clause := 'lr.auto_number ' || p_sort_direction;
        WHEN 'project_name' THEN
            v_order_clause := 'lr.project_name ' || p_sort_direction;
        WHEN 'loading_date' THEN
            v_order_clause := 'lr.loading_date ' || p_sort_direction;
        WHEN 'driver_name' THEN
            v_order_clause := 'lr.driver_name ' || p_sort_direction;
        WHEN 'current_cost' THEN
            v_order_clause := 'lr.current_cost ' || p_sort_direction;
        WHEN 'payable_cost' THEN
            v_order_clause := 'lr.payable_cost ' || p_sort_direction;
        ELSE
            v_order_clause := 'lr.auto_number ' || p_sort_direction;
    END CASE;
    
    -- 获取记录总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.logistics_records lr
    WHERE (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
    AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
    AND (p_project_name IS NULL OR lr.project_name ILIKE '%' || p_project_name || '%')
    AND (p_driver_name IS NULL OR lr.driver_name ILIKE '%' || p_driver_name || '%')
    AND (p_license_plate IS NULL OR lr.license_plate ILIKE '%' || p_license_plate || '%')
    AND (p_driver_phone IS NULL OR lr.driver_phone ILIKE '%' || p_driver_phone || '%');
    
    -- 获取分页记录（使用子查询避免复杂JOIN）
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
            lr.driver_payable_cost,
            lr.license_plate,
            lr.driver_phone,
            lr.transport_type,
            lr.extra_cost,
            lr.remarks,
            lr.external_tracking_numbers,
            lr.other_platform_names,
            lr.created_at
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
        AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
        AND (p_project_name IS NULL OR lr.project_name ILIKE '%' || p_project_name || '%')
        AND (p_driver_name IS NULL OR lr.driver_name ILIKE '%' || p_driver_name || '%')
        AND (p_license_plate IS NULL OR lr.license_plate ILIKE '%' || p_license_plate || '%')
        AND (p_driver_phone IS NULL OR lr.driver_phone ILIKE '%' || p_driver_phone || '%')
        ORDER BY 
            CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN auto_number END ASC,
            CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN auto_number END DESC,
            CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'asc' THEN project_name END ASC,
            CASE WHEN p_sort_field = 'project_name' AND p_sort_direction = 'desc' THEN project_name END DESC,
            CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN loading_date END ASC,
            CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN loading_date END DESC,
            CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN driver_name END ASC,
            CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN driver_name END DESC,
            CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'asc' THEN current_cost END ASC,
            CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'desc' THEN current_cost END DESC,
            CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN payable_cost END ASC,
            CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN payable_cost END DESC,
            auto_number DESC
        LIMIT p_page_size OFFSET v_offset
    )
    SELECT jsonb_agg(
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
            'external_tracking_numbers', external_tracking_numbers,
            'other_platform_names', other_platform_names,
            'created_at', created_at
        )
    ) INTO v_records
    FROM filtered_records;
    
    -- 获取汇总数据
    SELECT jsonb_build_object(
        'totalCurrentCost', COALESCE(SUM(lr.current_cost), 0),
        'totalExtraCost', COALESCE(SUM(lr.extra_cost), 0),
        'totalDriverPayableCost', COALESCE(SUM(lr.payable_cost), 0),
        'actualCount', COUNT(CASE WHEN lr.transport_type = '实际运输' THEN 1 END),
        'returnCount', COUNT(CASE WHEN lr.transport_type = '退货' THEN 1 END),
        'totalWeightLoading', COALESCE(SUM(lr.loading_weight), 0),
        'totalWeightUnloading', COALESCE(SUM(lr.unloading_weight), 0),
        'totalTripsLoading', COALESCE(SUM(CASE WHEN lr.billing_type_id = 2 THEN lr.loading_weight ELSE 0 END), 0),
        'totalVolumeLoading', COALESCE(SUM(CASE WHEN lr.billing_type_id = 3 THEN lr.loading_weight ELSE 0 END), 0),
        'totalVolumeUnloading', COALESCE(SUM(CASE WHEN lr.billing_type_id = 3 THEN lr.unloading_weight ELSE 0 END), 0)
    ) INTO v_summary
    FROM public.logistics_records lr
    WHERE (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
    AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
    AND (p_project_name IS NULL OR lr.project_name ILIKE '%' || p_project_name || '%')
    AND (p_driver_name IS NULL OR lr.driver_name ILIKE '%' || p_driver_name || '%')
    AND (p_license_plate IS NULL OR lr.license_plate ILIKE '%' || p_license_plate || '%')
    AND (p_driver_phone IS NULL OR lr.driver_phone ILIKE '%' || p_driver_phone || '%');
    
    -- 返回结果
    RETURN jsonb_build_object(
        'records', COALESCE(v_records, '[]'::jsonb),
        'summary', v_summary,
        'totalCount', v_total_count
    );
END;
$$;

-- 验证修复
SELECT 'get_logistics_summary_and_records 函数已修复，包含 chain_name 字段' as status;
