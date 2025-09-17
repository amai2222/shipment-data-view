-- 创建获取所有符合筛选条件的记录ID的函数
-- 用于支持真正的"全部记录"批量选择功能
CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_has_scale_record text DEFAULT NULL -- 'yes': 有磅单, 'no': 无磅单, NULL: 不筛选
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
        -- 去除每个元素的前后空格
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;

    WITH filtered_records AS (
        SELECT lr.id,
               lr.auto_number,
               lr.project_name,
               lr.driver_name,
               lr.license_plate,
               lr.loading_date,
               lr.created_at
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
    )
    SELECT jsonb_build_object(
        'recordIds', COALESCE(jsonb_agg(fr.id ORDER BY fr.loading_date DESC, fr.created_at DESC), '[]'::jsonb),
        'totalCount', COUNT(*),
        'summary', jsonb_build_object(
            'projectNames', COALESCE(jsonb_agg(DISTINCT fr.project_name ORDER BY fr.project_name), '[]'::jsonb),
            'driverNames', COALESCE(jsonb_agg(DISTINCT fr.driver_name ORDER BY fr.driver_name), '[]'::jsonb),
            'dateRange', jsonb_build_object(
                'earliest', MIN(fr.loading_date),
                'latest', MAX(fr.loading_date)
            )
        )
    ) INTO v_result
    FROM filtered_records fr;
    
    RETURN v_result;
END;
$$;
