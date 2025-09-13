-- 修复 chain_name 字段错误
-- 根据实际数据库结构，logistics_records 表没有 chain_name 字段

-- 1. 更新 get_logistics_summary_and_records 函数
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 25
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
BEGIN
    -- 计算偏移量
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 获取记录总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.logistics_records lr
    WHERE (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
    AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
    AND (p_project_name IS NULL OR lr.project_name ILIKE '%' || p_project_name || '%')
    AND (p_driver_name IS NULL OR lr.driver_name ILIKE '%' || p_driver_name || '%')
    AND (p_license_plate IS NULL OR lr.license_plate ILIKE '%' || p_license_plate || '%')
    AND (p_driver_phone IS NULL OR lr.driver_phone ILIKE '%' || p_driver_phone || '%');
    
    -- 获取分页记录（包含平台字段，移除不存在的 chain_name）
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', lr.id,
            'auto_number', lr.auto_number,
            'project_id', lr.project_id,
            'project_name', lr.project_name,
            'chain_id', lr.chain_id,
            'chain_name', NULL, -- 数据库中没有这个字段，设为 NULL
            'billing_type_id', lr.billing_type_id,
            'driver_id', lr.driver_id,
            'driver_name', lr.driver_name,
            'loading_location', lr.loading_location,
            'unloading_location', lr.unloading_location,
            'loading_date', lr.loading_date,
            'unloading_date', lr.unloading_date,
            'loading_weight', lr.loading_weight,
            'unloading_weight', lr.unloading_weight,
            'current_cost', lr.current_cost,
            'payable_cost', lr.payable_cost,
            'driver_payable_cost', lr.driver_payable_cost,
            'license_plate', lr.license_plate,
            'driver_phone', lr.driver_phone,
            'transport_type', lr.transport_type,
            'extra_cost', lr.extra_cost,
            'remarks', lr.remarks,
            'external_tracking_numbers', lr.external_tracking_numbers,
            'other_platform_names', lr.other_platform_names,
            'created_at', lr.created_at
        )
    ) INTO v_records
    FROM public.logistics_records lr
    WHERE (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date)
    AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date)
    AND (p_project_name IS NULL OR lr.project_name ILIKE '%' || p_project_name || '%')
    AND (p_driver_name IS NULL OR lr.driver_name ILIKE '%' || p_driver_name || '%')
    AND (p_license_plate IS NULL OR lr.license_plate ILIKE '%' || p_license_plate || '%')
    AND (p_driver_phone IS NULL OR lr.driver_phone ILIKE '%' || p_driver_phone || '%')
    ORDER BY lr.auto_number DESC
    LIMIT p_page_size OFFSET v_offset;
    
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

-- 2. 添加函数注释
COMMENT ON FUNCTION public.get_logistics_summary_and_records(text, text, text, text, text, text, integer, integer) IS '获取运单汇总和记录，包含平台字段，修复chain_name字段错误';

-- 3. 测试修复
DO $$
DECLARE
    result jsonb;
BEGIN
    RAISE NOTICE '=== 测试修复 chain_name 字段错误 ===';
    
    BEGIN
        result := public.get_logistics_summary_and_records();
        RAISE NOTICE '✓ 运单查询函数修复成功';
        RAISE NOTICE '记录数量: %', (result->>'totalCount')::integer;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 运单查询函数测试失败: %', SQLERRM;
    END;
    
    RAISE NOTICE '=== 修复完成 ===';
END $$;
