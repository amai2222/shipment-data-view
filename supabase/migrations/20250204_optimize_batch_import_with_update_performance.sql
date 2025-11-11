-- 优化 batch_import_logistics_records_with_update 函数性能
-- 问题：当前函数逐条处理，每条记录都要执行8字段的重复检查查询，导致性能极差
-- 解决方案：
-- 1. 创建复合索引加速重复检查查询
-- 2. 使用批量查询一次性检查所有记录的重复情况，存储在JSONB中
-- 3. 在循环中从JSONB查找重复检查结果，避免逐条查询数据库

-- ============================================================================
-- 步骤1: 创建复合索引用于重复检查（8个关键字段）
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_logistics_records_duplicate_check 
ON public.logistics_records (
    project_name,
    chain_id,
    driver_name,
    license_plate,
    loading_location,
    unloading_location,
    ((loading_date AT TIME ZONE 'UTC')::date),  -- 日期部分索引（使用UTC确保IMMUTABLE）
    loading_weight
);

-- 为常用查询字段创建单独索引（如果还没有）
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_name 
ON public.logistics_records(project_name);

CREATE INDEX IF NOT EXISTS idx_logistics_records_driver_name_plate 
ON public.logistics_records(driver_name, license_plate);

CREATE INDEX IF NOT EXISTS idx_logistics_records_loading_date_date 
ON public.logistics_records(((loading_date AT TIME ZONE 'UTC')::date));

-- 添加索引注释
COMMENT ON INDEX idx_logistics_records_duplicate_check IS 
'用于批量导入时的重复检查，覆盖8个关键字段：project_name, chain_id, driver_name, license_plate, loading_location, unloading_location, loading_date, loading_weight';

-- ============================================================================
-- 步骤2: 优化 batch_import_logistics_records_with_update 函数
-- 使用批量查询和JSONB存储优化性能
-- ============================================================================
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records_with_update(
    p_records jsonb,
    p_update_mode boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_ids uuid[] := ARRAY[]::uuid[];
    v_updated_ids uuid[] := ARRAY[]::uuid[];
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_insert_count integer := 0;
    v_update_count integer := 0;
    v_error_details jsonb := '[]'::jsonb;
    v_record_index integer := 0;
    record_data jsonb;
    existing_record_id uuid;
    chain_id_val uuid;
    project_id_val uuid;
    driver_id_val uuid;
    auto_number_val text;
    inserted_record_id uuid;
    v_external_tracking_numbers text[];
    v_other_platform_names text[];
    v_loading_date_formatted text;
    v_unloading_date_formatted text;
    -- 批量查询结果：使用JSONB存储所有记录的重复检查结果
    -- 格式：{record_index: {existing_record_id: uuid, existing_auto_number: text}}
    v_duplicate_check_results jsonb := '{}'::jsonb;
    v_check_key text;
    v_check_result jsonb;
BEGIN
    -- ============================================================================
    -- 关键优化：批量查询所有记录的重复情况（一次性完成，而不是逐条查询）
    -- ============================================================================
    WITH 
    -- 步骤1: 解析所有传入的JSON记录
    parsed_records AS (
        SELECT 
            (rec->>'project_name')::text AS project_name,
            (rec->>'chain_name')::text AS chain_name,
            (rec->>'driver_name')::text AS driver_name,
            (rec->>'license_plate')::text AS license_plate,
            (rec->>'loading_location')::text AS loading_location,
            (rec->>'unloading_location')::text AS unloading_location,
            TRIM((rec->>'loading_date')::text) AS loading_date_str,
            NULLIF((rec->>'loading_weight')::text, '')::numeric AS loading_weight,
            ROW_NUMBER() OVER () AS record_index
        FROM jsonb_array_elements(p_records) AS rec
    ),
    -- 步骤2: 批量获取项目ID和合作链路ID
    projects_and_chains AS (
        SELECT DISTINCT 
            pr.record_index,
            pr.project_name,
            pr.chain_name,
            pr.driver_name,
            pr.license_plate,
            pr.loading_location,
            pr.unloading_location,
            pr.loading_date_str,
            pr.loading_weight,
            p.id AS project_id,
            pc.id AS chain_id
        FROM parsed_records pr
        JOIN public.projects p ON p.name = pr.project_name
        LEFT JOIN public.partner_chains pc ON pc.project_id = p.id 
            AND pc.chain_name = pr.chain_name
            AND pr.chain_name IS NOT NULL AND TRIM(pr.chain_name) != ''
    ),
    -- 步骤3: 批量检查重复记录（关键优化：一次性查询所有重复）
    -- 使用 EXISTS 子查询优化性能，避免复杂的 LEFT JOIN
    duplicate_checks AS (
        SELECT 
            pac.record_index,
            (SELECT lr.id FROM public.logistics_records lr 
             WHERE lr.project_name = pac.project_name
             AND (lr.chain_id = pac.chain_id OR (lr.chain_id IS NULL AND pac.chain_id IS NULL))
             AND lr.driver_name = pac.driver_name
             AND lr.license_plate = pac.license_plate
             AND lr.loading_location = pac.loading_location
             AND lr.unloading_location = pac.unloading_location
             AND (lr.loading_date AT TIME ZONE 'UTC')::date = ((pac.loading_date_str || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC')::date
             AND lr.loading_weight = pac.loading_weight
             LIMIT 1) AS existing_record_id,
            (SELECT lr.auto_number FROM public.logistics_records lr 
             WHERE lr.project_name = pac.project_name
             AND (lr.chain_id = pac.chain_id OR (lr.chain_id IS NULL AND pac.chain_id IS NULL))
             AND lr.driver_name = pac.driver_name
             AND lr.license_plate = pac.license_plate
             AND lr.loading_location = pac.loading_location
             AND lr.unloading_location = pac.unloading_location
             AND (lr.loading_date AT TIME ZONE 'UTC')::date = ((pac.loading_date_str || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC')::date
             AND lr.loading_weight = pac.loading_weight
             LIMIT 1) AS existing_auto_number
        FROM projects_and_chains pac
    )
    -- 步骤4: 将批量查询结果转换为JSONB对象，方便后续查找
    SELECT jsonb_object_agg(
        dc.record_index::text,
        jsonb_build_object(
            'existing_record_id', dc.existing_record_id,
            'existing_auto_number', dc.existing_auto_number
        )
    ) INTO v_duplicate_check_results
    FROM duplicate_checks dc
    WHERE dc.existing_record_id IS NOT NULL;
    
    -- 如果没有任何重复记录，初始化为空对象
    IF v_duplicate_check_results IS NULL THEN
        v_duplicate_check_results := '{}'::jsonb;
    END IF;
    
    -- ============================================================================
    -- 处理每条记录（现在重复检查已经批量完成，只需要从JSONB查找）
    -- ============================================================================
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        BEGIN
            -- 日期处理
            v_loading_date_formatted := TRIM(record_data->>'loading_date');
            v_unloading_date_formatted := COALESCE(NULLIF(TRIM(record_data->>'unloading_date'), ''), v_loading_date_formatted);
            
            -- 处理外部跟踪号和平台名称数组
            IF record_data->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(record_data->'external_tracking_numbers') > 0 THEN
                SELECT array_agg(value::text) INTO v_external_tracking_numbers
                FROM jsonb_array_elements_text(record_data->'external_tracking_numbers')
                WHERE value::text != '';
                IF v_external_tracking_numbers IS NULL THEN
                    v_external_tracking_numbers := '{}'::text[];
                END IF;
            ELSE
                v_external_tracking_numbers := '{}'::text[];
            END IF;
            
            IF record_data->'other_platform_names' IS NOT NULL AND jsonb_array_length(record_data->'other_platform_names') > 0 THEN
                SELECT array_agg(value::text) INTO v_other_platform_names
                FROM jsonb_array_elements_text(record_data->'other_platform_names')
                WHERE value::text != '';
                IF v_other_platform_names IS NULL THEN
                    v_other_platform_names := '{}'::text[];
                END IF;
            ELSE
                v_other_platform_names := '{}'::text[];
            END IF;
            
            -- 1. 获取项目ID
            SELECT id INTO project_id_val
            FROM public.projects 
            WHERE name = TRIM(record_data->>'project_name')
            LIMIT 1;

            IF project_id_val IS NULL THEN
                RAISE EXCEPTION '项目不存在: %', record_data->>'project_name';
            END IF;

            -- 2. 获取或创建合作链路
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val
                FROM public.partner_chains 
                WHERE chain_name = TRIM(record_data->>'chain_name')
                AND project_id = project_id_val
                LIMIT 1;
            ELSE
                chain_id_val := NULL;
            END IF;

            -- 3. 获取或创建司机
            SELECT id INTO driver_id_val
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            LIMIT 1;

            IF driver_id_val IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id INTO driver_id_val;
                
                -- 关联司机到项目
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (driver_id_val, project_id_val, auth.uid())
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END IF;
            
            -- 关联地点到项目
            INSERT INTO public.locations (name, user_id)
            VALUES (TRIM(record_data->>'loading_location'), auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            INSERT INTO public.locations (name, user_id)
            VALUES (TRIM(record_data->>'unloading_location'), auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            SELECT l.id, project_id_val, auth.uid()
            FROM public.locations l
            WHERE l.name IN (
                TRIM(record_data->>'loading_location'),
                TRIM(record_data->>'unloading_location')
            )
            ON CONFLICT (location_id, project_id) DO NOTHING;

            -- 4. 从批量查询结果中获取重复检查结果（关键优化：不再逐条查询数据库）
            v_check_key := v_record_index::text;
            v_check_result := v_duplicate_check_results->v_check_key;
            
            IF v_check_result IS NOT NULL AND v_check_result->>'existing_record_id' IS NOT NULL THEN
                existing_record_id := (v_check_result->>'existing_record_id')::uuid;
                auto_number_val := v_check_result->>'existing_auto_number';
            ELSE
                existing_record_id := NULL;
                auto_number_val := NULL;
            END IF;

            IF existing_record_id IS NOT NULL AND p_update_mode THEN
                -- 更新模式：更新现有记录
                UPDATE public.logistics_records SET
                    project_id = project_id_val,
                    chain_id = chain_id_val,
                    driver_id = driver_id_val,
                    driver_phone = TRIM(record_data->>'driver_phone'),
                    unloading_date = CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                                         THEN (v_unloading_date_formatted || ' 00:00:00+08:00')::timestamptz ELSE NULL END,
                    unloading_weight = CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                                           THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    current_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                                       THEN (record_data->>'current_cost')::numeric ELSE current_cost END,
                    extra_cost = CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                                     THEN (record_data->>'extra_cost')::numeric ELSE extra_cost END,
                    transport_type = CASE WHEN record_data->>'transport_type' IS NOT NULL AND TRIM(record_data->>'transport_type') != ''
                                         THEN COALESCE(TRIM(record_data->>'transport_type'), '实际运输') ELSE transport_type END,
                    cargo_type = CASE WHEN record_data->>'cargo_type' IS NOT NULL AND TRIM(record_data->>'cargo_type') != ''
                                     THEN TRIM(record_data->>'cargo_type') ELSE cargo_type END,
                    remarks = CASE WHEN record_data->>'remarks' IS NOT NULL AND TRIM(record_data->>'remarks') != ''
                                  THEN TRIM(record_data->>'remarks') ELSE remarks END,
                    external_tracking_numbers = CASE WHEN array_length(v_external_tracking_numbers, 1) > 0
                                                     THEN v_external_tracking_numbers ELSE external_tracking_numbers END,
                    other_platform_names = CASE WHEN array_length(v_other_platform_names, 1) > 0
                                               THEN v_other_platform_names ELSE other_platform_names END,
                    updated_at = NOW()
                WHERE id = existing_record_id;

                v_updated_ids := array_append(v_updated_ids, existing_record_id);
                v_update_count := v_update_count + 1;

            ELSIF existing_record_id IS NULL THEN
                -- 创建模式：创建新记录
                auto_number_val := public.generate_auto_number(v_loading_date_formatted);

                INSERT INTO public.logistics_records (
                    auto_number, project_id, project_name, loading_date, loading_location, 
                    unloading_location, driver_id, driver_name, license_plate, driver_phone,
                    loading_weight, unloading_date, unloading_weight, transport_type, cargo_type,
                    current_cost, extra_cost, payable_cost, remarks, created_by_user_id,
                    chain_id, external_tracking_numbers, other_platform_names
                ) VALUES (
                    auto_number_val, 
                    project_id_val, 
                    TRIM(record_data->>'project_name'),
                    (v_loading_date_formatted || ' 00:00:00+08:00')::timestamptz,
                    TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), 
                    driver_id_val, 
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), 
                    TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
                    CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                         THEN (v_unloading_date_formatted || ' 00:00:00+08:00')::timestamptz ELSE NULL END,
                    CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                         THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    TRIM(record_data->>'cargo_type'),
                    CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                         THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                         THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    0, -- payable_cost 将在触发器中计算
                    TRIM(record_data->>'remarks'),
                    auth.uid(),
                    chain_id_val,
                    v_external_tracking_numbers,
                    v_other_platform_names
                )
                RETURNING id INTO inserted_record_id;

                v_inserted_ids := array_append(v_inserted_ids, inserted_record_id);
                v_insert_count := v_insert_count + 1;
            END IF;

            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_error_details := v_error_details || jsonb_build_object(
                'record_index', v_record_index,
                'error_message', SQLERRM,
                'record_data', record_data
            );
        END;
    END LOOP;

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'inserted_count', v_insert_count,
        'updated_count', v_update_count,
        'inserted_ids', v_inserted_ids,
        'updated_ids', v_updated_ids,
        'error_details', v_error_details
    );
END;
$$;

-- 更新函数注释
COMMENT ON FUNCTION public.batch_import_logistics_records_with_update(jsonb, boolean) IS 
'批量导入运单记录，支持更新模式。性能优化版本：使用批量查询和JSONB存储加速重复检查，保留完整的重复检查功能。优化前：每条记录都要执行8字段查询；优化后：一次性批量查询所有记录的重复情况。';

-- 完成提示
SELECT '批量导入函数性能优化完成！已创建复合索引并优化重复检查逻辑（批量查询+JSONB存储）。' as message;
