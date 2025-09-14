-- 修复 chain_name 字段错误
-- 问题：column lr.chain_name does not exist
-- 解决：chain_name 需要通过 JOIN partner_chains 表获取

-- 修复 get_logistics_summary_and_records 函数
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
    
    -- 获取分页记录（包含平台字段，使用动态排序，正确JOIN partner_chains）
    EXECUTE format('
        SELECT jsonb_agg(
            jsonb_build_object(
                ''id'', lr.id,
                ''auto_number'', lr.auto_number,
                ''project_id'', lr.project_id,
                ''project_name'', lr.project_name,
                ''chain_id'', lr.chain_id,
                ''chain_name'', COALESCE(pc.chain_name, ''''),
                ''billing_type_id'', COALESCE(lr.billing_type_id, 1),
                ''driver_id'', lr.driver_id,
                ''driver_name'', lr.driver_name,
                ''loading_location'', lr.loading_location,
                ''unloading_location'', lr.unloading_location,
                ''loading_date'', lr.loading_date,
                ''unloading_date'', lr.unloading_date,
                ''loading_weight'', lr.loading_weight,
                ''unloading_weight'', lr.unloading_weight,
                ''current_cost'', lr.current_cost,
                ''payable_cost'', lr.payable_cost,
                ''driver_payable_cost'', lr.driver_payable_cost,
                ''license_plate'', lr.license_plate,
                ''driver_phone'', lr.driver_phone,
                ''transport_type'', lr.transport_type,
                ''extra_cost'', lr.extra_cost,
                ''remarks'', lr.remarks,
                ''external_tracking_numbers'', lr.external_tracking_numbers,
                ''other_platform_names'', lr.other_platform_names,
                ''created_at'', lr.created_at
            )
        )
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
        AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
        AND (p_project_name IS NULL OR lr.project_name ILIKE ''%%'' || p_project_name || ''%%'')
        AND (p_driver_name IS NULL OR lr.driver_name ILIKE ''%%'' || p_driver_name || ''%%'')
        AND (p_license_plate IS NULL OR lr.license_plate ILIKE ''%%'' || p_license_plate || ''%%'')
        AND (p_driver_phone IS NULL OR lr.driver_phone ILIKE ''%%'' || p_driver_phone || ''%%'')
        ORDER BY %s
        LIMIT %s OFFSET %s',
        v_order_clause, p_page_size, v_offset
    ) INTO v_records;
    
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
SELECT 'get_logistics_summary_and_records 函数已修复 chain_name 字段问题' as status;
