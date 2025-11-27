-- ============================================================================
-- 批量调试函数：帮助找出验重失败的原因
-- ============================================================================
-- 此函数用于批量调试标准版导入的验重逻辑，帮助找出为什么某些记录无法匹配
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_debug_duplicate_check(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    record_data jsonb;
    debug_result jsonb;
    project_id_val uuid;
    driver_id_val uuid;
    matching_count integer;
    location_normalized_db text;
    location_normalized_input text;
BEGIN
    -- 遍历每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 检查项目是否存在
            SELECT id INTO project_id_val 
            FROM public.projects 
            WHERE UPPER(TRIM(name)) = UPPER(TRIM(record_data->>'project_name'))
            LIMIT 1;
            
            -- 检查司机是否存在
            SELECT id INTO driver_id_val
            FROM public.drivers
            WHERE UPPER(TRIM(name)) = UPPER(TRIM(record_data->>'driver_name'))
                AND UPPER(TRIM(license_plate)) = UPPER(TRIM(record_data->>'license_plate'))
            LIMIT 1;
            
            -- 查找匹配的记录数量
            SELECT COUNT(*) INTO matching_count
            FROM public.logistics_records lr
            WHERE lr.project_id = project_id_val
                AND lr.driver_id = driver_id_val
                AND UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(lr.loading_location, ''), '\s+', '', 'g'), '[→->—－]', '', 'g')) = 
                    UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(record_data->>'loading_location', ''), '\s+', '', 'g'), '[→->—－]', '', 'g'))
                AND UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(lr.unloading_location, ''), '\s+', '', 'g'), '[→->—－]', '', 'g')) = 
                    UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(record_data->>'unloading_location', ''), '\s+', '', 'g'), '[→->—－]', '', 'g'))
                AND (lr.loading_date AT TIME ZONE 'UTC' AT TIME ZONE '+08:00')::date = (TRIM(record_data->>'loading_date'))::date
                AND (
                    CASE 
                        WHEN record_data->>'loading_weight' IS NULL OR TRIM(record_data->>'loading_weight') = '' THEN
                            lr.loading_weight IS NULL
                        WHEN lr.loading_weight IS NULL THEN
                            FALSE
                        ELSE
                            CASE 
                                WHEN (record_data->>'loading_weight')::text ~ '^-?\d+\.?\d*([eE][+-]?\d+)?$' THEN
                                    ABS(ROUND(COALESCE(lr.loading_weight, 0)::numeric, 2) - ROUND((record_data->>'loading_weight')::numeric, 2)) < 0.01
                                ELSE
                                    FALSE
                            END
                    END
                );
            
            -- 获取数据库中的地点名称（用于对比）
            SELECT 
                UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(lr.loading_location, ''), '\s+', '', 'g'), '[→->—－]', '', 'g')),
                UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(lr.unloading_location, ''), '\s+', '', 'g'), '[→->—－]', '', 'g'))
            INTO location_normalized_db, location_normalized_input
            FROM public.logistics_records lr
            WHERE lr.project_id = project_id_val
                AND lr.driver_id = driver_id_val
            LIMIT 1;
            
            -- 构建调试结果
            debug_result := jsonb_build_object(
                'record', record_data,
                'project_found', project_id_val IS NOT NULL,
                'project_id', project_id_val,
                'driver_found', driver_id_val IS NOT NULL,
                'driver_id', driver_id_val,
                'matching_count', matching_count,
                'is_duplicate', matching_count > 0,
                'normalized_locations', jsonb_build_object(
                    'loading_location_db', location_normalized_db,
                    'loading_location_input', UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(record_data->>'loading_location', ''), '\s+', '', 'g'), '[→->—－]', '', 'g')),
                    'unloading_location_db', location_normalized_input,
                    'unloading_location_input', UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(record_data->>'unloading_location', ''), '\s+', '', 'g'), '[→->—－]', '', 'g'))
                )
            );
            
            result := result || debug_result;
            
        EXCEPTION WHEN OTHERS THEN
            result := result || jsonb_build_object(
                'record', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'total_records', jsonb_array_length(p_records),
        'debug_results', result
    );
END;
$$;

COMMENT ON FUNCTION public.batch_debug_duplicate_check IS 
'批量调试函数：帮助找出验重失败的原因。用于排查标准版导入时为什么某些记录无法匹配为重复记录。';

-- 完成提示
SELECT '✅ batch_debug_duplicate_check 函数已创建：可用于批量调试验重逻辑' AS status;

