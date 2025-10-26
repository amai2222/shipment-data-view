-- 修复后的get_all_filtered_record_ids函数
-- 文件路径: scripts/fix-get-all-filtered-records-function.sql
-- 描述: 修复created_at字段不存在的错误

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
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    -- 解析运单编号字符串为数组（支持批量搜索）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    -- 解析司机名称字符串为数组（支持批量搜索）
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    -- 解析车牌号字符串为数组（支持批量搜索）
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    -- 解析电话字符串为数组（支持批量搜索）
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    WITH filtered_records AS (
        SELECT lr.id,
               lr.auto_number,
               lr.project_name,
               lr.driver_name,
               lr.license_plate,
               lr.loading_date
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            -- 司机筛选（支持批量，OR逻辑）
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            -- 车牌号筛选（支持批量，OR逻辑）
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            -- 电话筛选（支持批量，OR逻辑）
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
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
        'recordIds', COALESCE(jsonb_agg(fr.id ORDER BY fr.loading_date DESC), '[]'::jsonb),
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
