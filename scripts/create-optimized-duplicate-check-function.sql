-- 创建优化后的重复检测函数（新增函数，不影响现有函数）
-- 文件: scripts/create-optimized-duplicate-check-function.sql

-- 1. 创建新的优化重复检测函数
CREATE OR REPLACE FUNCTION public.preview_import_with_optimized_duplicate_check(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    new_records_json jsonb := '[]'::jsonb;
    duplicate_records_json jsonb := '[]'::jsonb;
    error_records_json jsonb := '[]'::jsonb;
    project_exists boolean;
    is_duplicate boolean;
    is_excel_duplicate boolean;
    chain_name_val text;
    loading_date_formatted text;
    chain_id_val uuid;
    existing_record record;
    excel_duplicate_count integer;
    record_index integer := 0;
BEGIN
    -- 处理每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        record_index := record_index + 1;
        
        -- 1. 检查必填字段（9个关键字段）
        IF (record_data->>'project_name') IS NULL OR (record_data->>'project_name') = '' OR
           (record_data->>'driver_name') IS NULL OR (record_data->>'driver_name') = '' OR
           (record_data->>'license_plate') IS NULL OR (record_data->>'license_plate') = '' OR
           (record_data->>'loading_location') IS NULL OR (record_data->>'loading_location') = '' OR
           (record_data->>'unloading_location') IS NULL OR (record_data->>'unloading_location') = '' OR
           (record_data->>'loading_date') IS NULL OR (record_data->>'loading_date') = '' OR
           (record_data->>'loading_weight') IS NULL OR (record_data->>'loading_weight') = '' OR
           (record_data->>'unloading_weight') IS NULL OR (record_data->>'unloading_weight') = '' THEN
            error_records_json := error_records_json || jsonb_build_object(
                'record', record_data, 
                'error', '缺少必填字段（9个关键字段）',
                'row_index', record_index
            );
            CONTINUE;
        END IF;

        -- 2. 检查项目是否存在
        SELECT EXISTS (SELECT 1 FROM public.projects WHERE name = (record_data->>'project_name')) INTO project_exists;
        IF NOT project_exists THEN
            error_records_json := error_records_json || jsonb_build_object(
                'record', record_data, 
                'error', '项目不存在',
                'row_index', record_index
            );
            CONTINUE;
        END IF;

        -- 3. 获取合作链路ID（如果提供了合作链路名称）
        chain_name_val := record_data->>'chain_name';
        IF chain_name_val IS NOT NULL AND chain_name_val != '' THEN
            SELECT id INTO chain_id_val FROM public.partner_chains WHERE chain_name = chain_name_val;
        ELSE
            chain_id_val := NULL;
        END IF;

        loading_date_formatted := (record_data->>'loading_date');

        -- 4. 优先检测与数据库现有记录重复
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            WHERE
                lr.project_name = (record_data->>'project_name')
                AND lr.chain_id = chain_id_val
                AND lr.driver_name = (record_data->>'driver_name')
                AND lr.license_plate = (record_data->>'license_plate')
                AND lr.loading_location = (record_data->>'loading_location')
                AND lr.unloading_location = (record_data->>'unloading_location')
                AND lr.loading_date::date = loading_date_formatted::date
                AND lr.loading_weight = (record_data->>'loading_weight')::numeric
                AND lr.unloading_weight = (record_data->>'unloading_weight')::numeric
        ) INTO is_duplicate;

        -- 5. 分类记录
        IF is_duplicate THEN
            -- 与数据库重复（优先级最高）
            SELECT lr.* INTO existing_record
            FROM public.logistics_records lr
            WHERE
                lr.project_name = (record_data->>'project_name')
                AND lr.chain_id = chain_id_val
                AND lr.driver_name = (record_data->>'driver_name')
                AND lr.license_plate = (record_data->>'license_plate')
                AND lr.loading_location = (record_data->>'loading_location')
                AND lr.unloading_location = (record_data->>'unloading_location')
                AND lr.loading_date::date = loading_date_formatted::date
                AND lr.loading_weight = (record_data->>'loading_weight')::numeric
                AND lr.unloading_weight = (record_data->>'unloading_weight')::numeric
            ORDER BY lr.loading_date DESC, lr.created_at DESC
            LIMIT 1;
            
            duplicate_records_json := duplicate_records_json || jsonb_build_object(
                'record', record_data,
                'existing_auto_number', existing_record.auto_number,
                'existing_loading_date', existing_record.loading_date,
                'existing_created_at', existing_record.created_at,
                'duplicate_type', 'database',
                'row_index', record_index
            );
        ELSE
            -- 数据库无重复时，检测Excel内部重复
            SELECT COUNT(*) INTO excel_duplicate_count
            FROM jsonb_array_elements(p_records) AS other_record
            WHERE 
                TRIM(other_record->>'project_name') = TRIM(record_data->>'project_name')
                AND TRIM(other_record->>'driver_name') = TRIM(record_data->>'driver_name')
                AND TRIM(other_record->>'license_plate') = TRIM(record_data->>'license_plate')
                AND TRIM(other_record->>'loading_location') = TRIM(record_data->>'loading_location')
                AND TRIM(other_record->>'unloading_location') = TRIM(record_data->>'unloading_location')
                AND other_record->>'loading_date' = record_data->>'loading_date'
                AND other_record->>'loading_weight' = record_data->>'loading_weight'
                AND other_record->>'unloading_weight' = record_data->>'unloading_weight'
                AND (
                    (chain_name_val IS NULL AND other_record->>'chain_name' IS NULL) OR
                    (chain_name_val IS NOT NULL AND other_record->>'chain_name' = chain_name_val)
                );

            is_excel_duplicate := excel_duplicate_count > 1;

            IF is_excel_duplicate THEN
                -- Excel内部重复
                duplicate_records_json := duplicate_records_json || jsonb_build_object(
                    'record', record_data,
                    'duplicate_type', 'excel',
                    'duplicate_count', excel_duplicate_count,
                    'row_index', record_index
                );
            ELSE
                -- 新记录
                new_records_json := new_records_json || jsonb_build_object(
                    'record', record_data,
                    'row_index', record_index
                );
            END IF;
        END IF;

    END LOOP;

    -- 6. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'duplicate_records', duplicate_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 2. 添加函数注释
COMMENT ON FUNCTION public.preview_import_with_optimized_duplicate_check(jsonb) IS 
'优化后的重复检测函数：
1. 优先检测与数据库现有记录重复 (duplicate_type: database)
   - 如果数据库有重复，Excel内部重复自动按数据库重复处理
2. 仅在数据库无重复时检测Excel内部重复 (duplicate_type: excel)
   - 如果数据库无重复，Excel内部重复才提示用户选择处理方式

验重字段（9个关键字段）：
1. 项目名称 (project_name)
2. 合作链路 (chain_id)
3. 司机姓名 (driver_name)
4. 车牌号 (license_plate)
5. 装货地点 (loading_location)
6. 卸货地点 (unloading_location)
7. 装货日期 (loading_date)
8. 装货数量 (loading_weight)
9. 卸货数量 (unloading_weight)

重复数据按日期倒序显示（最新的在前）';
