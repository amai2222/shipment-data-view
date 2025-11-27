-- ============================================================================
-- 调试函数：帮助找出验重失败的原因
-- ============================================================================
-- 此函数用于调试标准版导入的验重逻辑，帮助找出为什么某些记录无法匹配
-- ============================================================================

CREATE OR REPLACE FUNCTION public.debug_duplicate_check(
    p_project_name text,
    p_driver_name text,
    p_license_plate text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date text,
    p_loading_weight text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb := '{}'::jsonb;
    project_id_val uuid;
    driver_id_val uuid;
    matching_records jsonb := '[]'::jsonb;
    record_data jsonb;
BEGIN
    -- 1. 检查项目是否存在
    SELECT id INTO project_id_val 
    FROM public.projects 
    WHERE UPPER(TRIM(name)) = UPPER(TRIM(p_project_name))
    LIMIT 1;
    
    result := result || jsonb_build_object(
        'project_found', project_id_val IS NOT NULL,
        'project_id', project_id_val,
        'project_name_input', p_project_name,
        'project_name_normalized', UPPER(TRIM(p_project_name))
    );
    
    IF project_id_val IS NULL THEN
        RETURN result || jsonb_build_object('error', '项目不存在');
    END IF;
    
    -- 2. 检查司机是否存在
    SELECT id INTO driver_id_val
    FROM public.drivers
    WHERE UPPER(TRIM(name)) = UPPER(TRIM(p_driver_name))
        AND UPPER(TRIM(license_plate)) = UPPER(TRIM(p_license_plate))
    LIMIT 1;
    
    result := result || jsonb_build_object(
        'driver_found', driver_id_val IS NOT NULL,
        'driver_id', driver_id_val,
        'driver_name_input', p_driver_name,
        'driver_name_normalized', UPPER(TRIM(p_driver_name)),
        'license_plate_input', p_license_plate,
        'license_plate_normalized', UPPER(TRIM(p_license_plate))
    );
    
    IF driver_id_val IS NULL THEN
        RETURN result || jsonb_build_object('error', '司机不存在');
    END IF;
    
    -- 3. 查找匹配的记录（逐步检查每个条件）
    FOR record_data IN
        SELECT 
            lr.id,
            lr.auto_number,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.loading_weight,
            -- 检查每个条件是否匹配
            CASE 
                WHEN (p_loading_location IS NULL OR TRIM(p_loading_location) = '') THEN
                    (lr.loading_location IS NULL OR TRIM(lr.loading_location) = '')
                ELSE
                    UPPER(TRIM(lr.loading_location)) = UPPER(TRIM(p_loading_location))
            END as loading_location_match,
            CASE 
                WHEN (p_unloading_location IS NULL OR TRIM(p_unloading_location) = '') THEN
                    (lr.unloading_location IS NULL OR TRIM(lr.unloading_location) = '')
                ELSE
                    UPPER(TRIM(lr.unloading_location)) = UPPER(TRIM(p_unloading_location))
            END as unloading_location_match,
            CASE 
                WHEN (lr.loading_date AT TIME ZONE 'UTC' AT TIME ZONE '+08:00')::date = p_loading_date::date THEN TRUE
                ELSE FALSE
            END as loading_date_match,
            CASE 
                WHEN p_loading_weight IS NULL OR TRIM(p_loading_weight) = '' THEN
                    lr.loading_weight IS NULL
                WHEN p_loading_weight::text ~ '^-?\d+\.?\d*$' THEN
                    ROUND(COALESCE(lr.loading_weight, 0)::numeric, 4) = ROUND(p_loading_weight::numeric, 4)
                ELSE
                    FALSE
            END as loading_weight_match
        FROM public.logistics_records lr
        WHERE lr.project_id = project_id_val
            AND lr.driver_id = driver_id_val
    LOOP
        matching_records := matching_records || jsonb_build_object(
            'id', record_data->>'id',
            'auto_number', record_data->>'auto_number',
            'loading_location', record_data->>'loading_location',
            'unloading_location', record_data->>'unloading_location',
            'loading_date', record_data->>'loading_date',
            'loading_weight', record_data->>'loading_weight',
            'matches', jsonb_build_object(
                'loading_location', record_data->>'loading_location_match',
                'unloading_location', record_data->>'unloading_location_match',
                'loading_date', record_data->>'loading_date_match',
                'loading_weight', record_data->>'loading_weight_match',
                'all_match', (
                    (record_data->>'loading_location_match')::boolean AND
                    (record_data->>'unloading_location_match')::boolean AND
                    (record_data->>'loading_date_match')::boolean AND
                    (record_data->>'loading_weight_match')::boolean
                )
            )
        );
    END LOOP;
    
    result := result || jsonb_build_object(
        'matching_records', matching_records,
        'matching_count', jsonb_array_length(matching_records),
        'input_values', jsonb_build_object(
            'loading_location', p_loading_location,
            'unloading_location', p_unloading_location,
            'loading_date', p_loading_date,
            'loading_weight', p_loading_weight
        )
    );
    
    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.debug_duplicate_check IS 
'调试函数：帮助找出验重失败的原因。用于排查标准版导入时为什么某些记录无法匹配为重复记录。';

-- 完成提示
SELECT '✅ debug_duplicate_check 函数已创建：可用于调试验重逻辑' AS status;

