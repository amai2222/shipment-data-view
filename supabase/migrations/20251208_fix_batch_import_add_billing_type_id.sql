-- ============================================================================
-- 修复批量导入函数：添加 billing_type_id 支持
-- ============================================================================
-- 功能：
-- 1. 将 batch_import_logistics_records_with_update_1123 修改为 batch_import_logistics_records_with_update_1208
-- 2. 在获取 chain_id 时同时获取 billing_type_id
-- 3. 在插入和更新记录时设置 billing_type_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_import_logistics_records_with_update_1208(
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
    v_billing_type_id bigint;  -- ✅ 新增：计费类型ID变量
    project_id_val uuid;
    driver_id_val uuid;
    loading_location_id uuid;
    unloading_location_id uuid;
    auto_number_val text;
    inserted_record_id uuid;
    v_external_tracking_numbers text[];
    v_other_platform_names text[];
    v_loading_date_formatted text;
    v_unloading_date_formatted text;
    v_duplicate_check_results jsonb := '{}'::jsonb;
    v_check_key text;
    v_check_result jsonb;
BEGIN
    -- ============================================================================
    -- 第一阶段：批量查询所有记录的重复情况（性能优化）
    -- ============================================================================
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        v_check_key := v_record_index::text;
        
        BEGIN
            SELECT lr.id, lr.auto_number INTO existing_record_id, auto_number_val
            FROM public.logistics_records lr
            JOIN public.projects p ON p.name = TRIM(record_data->>'project_name')
            JOIN public.drivers d ON d.name = TRIM(record_data->>'driver_name') AND d.license_plate = TRIM(record_data->>'license_plate')
            WHERE lr.project_id = p.id
              AND lr.driver_id = d.id
              AND lr.loading_location = TRIM(record_data->>'loading_location')
              AND lr.unloading_location = TRIM(record_data->>'unloading_location')
              AND (lr.loading_date AT TIME ZONE 'UTC')::date = (TRIM(record_data->>'loading_date'))::date
              AND (COALESCE((lr.loading_weight)::text, '') = COALESCE(NULLIF(TRIM(record_data->>'loading_weight'), ''), ''))
              AND (COALESCE((lr.unloading_weight)::text, '') = COALESCE(NULLIF(TRIM(record_data->>'unloading_weight'), ''), ''))
              AND (COALESCE(lr.transport_type, '') = COALESCE(NULLIF(TRIM(record_data->>'transport_type'), ''), ''))
            LIMIT 1;
            
            v_duplicate_check_results := v_duplicate_check_results || jsonb_build_object(
                v_check_key, 
                jsonb_build_object(
                    'existing_record_id', existing_record_id,
                    'existing_auto_number', auto_number_val
                )
            );
        EXCEPTION WHEN OTHERS THEN
            v_duplicate_check_results := v_duplicate_check_results || jsonb_build_object(
                v_check_key,
                jsonb_build_object('existing_record_id', null, 'existing_auto_number', null)
            );
        END;
    END LOOP;

    -- ============================================================================
    -- 第二阶段：遍历所有记录，执行插入或更新操作
    -- ============================================================================
    v_record_index := 0;
    
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        v_check_key := v_record_index::text;
        v_check_result := v_duplicate_check_results->v_check_key;
        
        existing_record_id := (v_check_result->>'existing_record_id')::uuid;
        
        BEGIN
            SELECT id INTO project_id_val FROM public.projects WHERE name = TRIM(record_data->>'project_name') LIMIT 1;
            
            -- ✅ 修复：查找或创建司机
            SELECT id INTO driver_id_val 
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name') 
            AND license_plate = TRIM(record_data->>'license_plate') 
            LIMIT 1;
            
            -- 如果司机不存在，创建新司机
            IF driver_id_val IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id INTO driver_id_val;
                
                -- ✅ 关联司机到项目
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (driver_id_val, project_id_val, auth.uid())
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END IF;
            
            -- ✅ 修复：在获取 chain_id 时同时获取 billing_type_id
            chain_id_val := NULL;
            v_billing_type_id := 1;  -- 默认值为1（计吨）
            
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id, COALESCE(billing_type_id, 1) INTO chain_id_val, v_billing_type_id
                FROM public.partner_chains 
                WHERE chain_name = TRIM(record_data->>'chain_name') 
                AND project_id = project_id_val 
                LIMIT 1;
                
                -- 如果链路不存在，billing_type_id 保持默认值 1
                -- 注意：这里不自动创建链路，因为链路创建应该在项目配置中完成
            END IF;

            -- ✅ 新增：查找或创建装货地点
            SELECT id INTO loading_location_id
            FROM public.locations
            WHERE name = TRIM(record_data->>'loading_location')
            LIMIT 1;
            
            IF loading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES (TRIM(record_data->>'loading_location'), auth.uid())
                RETURNING id INTO loading_location_id;
            END IF;
            
            -- ✅ 新增：查找或创建卸货地点
            SELECT id INTO unloading_location_id
            FROM public.locations
            WHERE name = TRIM(record_data->>'unloading_location')
            LIMIT 1;
            
            IF unloading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES (TRIM(record_data->>'unloading_location'), auth.uid())
                RETURNING id INTO unloading_location_id;
            END IF;
            
            -- ✅ 新增：关联地点到项目
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            VALUES (loading_location_id, project_id_val, auth.uid())
            ON CONFLICT (location_id, project_id) DO NOTHING;
            
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            VALUES (unloading_location_id, project_id_val, auth.uid())
            ON CONFLICT (location_id, project_id) DO NOTHING;

            -- ✅ 日期处理：读取Excel的日期，然后转换为UTC存入数据库（与模板导入保持一致）
            -- 流程：
            -- 1. Excel中的日期：2025-12-4 或 2025-12-04（中国时区日期）
            -- 2. 前端解析后传递：'2025-12-4' 或 '2025-12-04'（可能没有前导零）
            -- 3. 后端标准化：确保格式为 YYYY-MM-DD（标准化日期格式）
            -- 4. 后端转换：'2025-12-04' || ' 00:00:00+08:00' → 2025-12-04 00:00:00+08:00
            -- 5. 存储为UTC：PostgreSQL自动转换为UTC → 2025-12-03 16:00:00+00（UTC）
            -- ✅ 修复：确保日期字符串不为空，并标准化日期格式（与标准版保持一致）
            v_loading_date_formatted := NULLIF(TRIM(record_data->>'loading_date'), '');
            IF v_loading_date_formatted IS NULL OR v_loading_date_formatted = '' THEN
                RAISE EXCEPTION '装货日期不能为空';
            END IF;
            -- ✅ 标准化日期格式：将 '2025-12-4' 转换为 '2025-12-04'，确保格式一致
            -- 使用 to_date 解析日期（支持多种格式），然后格式化为标准 YYYY-MM-DD 格式
            v_loading_date_formatted := to_char(to_date(v_loading_date_formatted, 'YYYY-MM-DD'), 'YYYY-MM-DD');
            v_unloading_date_formatted := COALESCE(NULLIF(TRIM(record_data->>'unloading_date'), ''), v_loading_date_formatted);
            IF v_unloading_date_formatted IS NOT NULL AND v_unloading_date_formatted != '' THEN
                -- ✅ 标准化卸货日期格式
                v_unloading_date_formatted := to_char(to_date(v_unloading_date_formatted, 'YYYY-MM-DD'), 'YYYY-MM-DD');
            END IF;

            v_external_tracking_numbers := CASE 
                WHEN record_data->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(record_data->'external_tracking_numbers') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(record_data->'external_tracking_numbers') AS value WHERE value::text != '')
                ELSE '{}'::text[]
            END;

            v_other_platform_names := CASE 
                WHEN record_data->'other_platform_names' IS NOT NULL AND jsonb_array_length(record_data->'other_platform_names') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(record_data->'other_platform_names') AS value WHERE value::text != '')
                ELSE '{}'::text[]
            END;

            IF p_update_mode AND existing_record_id IS NOT NULL THEN
                UPDATE public.logistics_records SET
                    project_id = project_id_val,
                    chain_id = chain_id_val,
                    billing_type_id = v_billing_type_id,  -- ✅ 新增：设置计费类型ID
                    -- ✅ 将Excel读取的中国时区日期转换为UTC存储（与模板导入保持一致）
                    -- 示例：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00 → 2025-01-14 16:00:00+00 (UTC)
                    -- ✅ 修复：确保日期格式正确，与标准版保持一致
                    loading_date = ((v_loading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz,
                    unloading_date = CASE 
                        WHEN v_unloading_date_formatted IS NOT NULL AND v_unloading_date_formatted != '' 
                        THEN ((v_unloading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz 
                        ELSE NULL 
                    END,
                    loading_weight = CASE WHEN record_data->>'loading_weight' IS NOT NULL AND TRIM(record_data->>'loading_weight') != '' THEN (record_data->>'loading_weight')::numeric ELSE NULL END,
                    unloading_weight = CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    transport_type = COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    current_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    extra_cost = CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    remarks = TRIM(record_data->>'remarks'),
                    external_tracking_numbers = v_external_tracking_numbers,
                    other_platform_names = v_other_platform_names
                WHERE id = existing_record_id;
                
                v_updated_ids := array_append(v_updated_ids, existing_record_id);
                v_update_count := v_update_count + 1;
            ELSIF existing_record_id IS NULL THEN
                auto_number_val := public.generate_auto_number(v_loading_date_formatted);
                
                INSERT INTO public.logistics_records (
                    auto_number, project_id, project_name, loading_date, loading_location, 
                    unloading_location, driver_id, driver_name, license_plate, driver_phone,
                    loading_weight, unloading_date, unloading_weight, transport_type, cargo_type,
                    current_cost, extra_cost, payable_cost, remarks, created_by_user_id,
                    chain_id, billing_type_id, external_tracking_numbers, other_platform_names  -- ✅ 新增：billing_type_id
                ) VALUES (
                    auto_number_val, 
                    project_id_val, 
                    TRIM(record_data->>'project_name'),
                    -- ✅ 将Excel读取的中国时区日期转换为UTC存储（与模板导入保持一致）
                    -- 示例：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00 → 2025-01-14 16:00:00+00 (UTC)
                    -- ✅ 修复：确保日期格式正确，与标准版保持一致
                    ((v_loading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz,
                    TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), 
                    driver_id_val, 
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), 
                    TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
                    -- ✅ 将Excel读取的中国时区日期转换为UTC存储（与模板导入保持一致）
                    -- 示例：'2025-01-15' || ' 00:00:00+08:00' → 2025-01-15 00:00:00+08:00 → 2025-01-14 16:00:00+00 (UTC)
                    -- ✅ 修复：确保日期格式正确，与标准版保持一致
                    CASE WHEN v_unloading_date_formatted IS NOT NULL AND v_unloading_date_formatted != '' 
                         THEN ((v_unloading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz ELSE NULL END,
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
                    v_billing_type_id,  -- ✅ 新增：使用从合作链路获取的计费类型ID
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

    -- ✅ 调用成本重算函数（与模板导入保持一致）
    IF array_length(v_inserted_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
    END IF;
    
    -- ✅ 对更新的记录也重新计算成本
    IF array_length(v_updated_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_updated_ids);
    END IF;

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

COMMENT ON FUNCTION public.batch_import_logistics_records_with_update_1208(jsonb, boolean) IS 
'批量导入运单记录，支持更新模式。
版本：1208
已修复：
1. 添加了合作方成本自动重算功能
2. 添加了地点自动创建功能（装货地点和卸货地点会自动插入到 locations 表）
3. 添加了地点到项目的自动关联功能
4. ✅ 新增：在获取 chain_id 时同时获取 billing_type_id，并在插入和更新时设置它
    - 如果合作链路存在，使用链路的 billing_type_id
    - 如果合作链路不存在或没有 billing_type_id，使用默认值 1（计吨）';

-- 验证
SELECT '✅ 函数已创建：batch_import_logistics_records_with_update_1208，已添加 billing_type_id 支持' AS status;

-- ============================================================================
-- 标准版函数：batch_import_logistics_records_1208
-- 描述: 标准批量导入函数（高性能 CTE 版本，支持外部运单号和其他平台名称，已修复 billing_type_id）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records_1208(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_ids uuid[];
    v_success_count integer;
    v_error_count integer;
    v_error_details jsonb := '[]'::jsonb;
    v_total_records integer;
BEGIN
    -- 使用公共表表达式(CTE)进行高性能、无冲突的集合式处理
    WITH
    -- 步骤1: 解析并结构化所有传入的JSON记录，并使用窗口函数预分配当日序号
    parsed_data AS (
        SELECT
            (rec->>'project_name')::text AS project_name,
            (rec->>'driver_name')::text AS driver_name,
            (rec->>'license_plate')::text AS license_plate,
            (rec->>'driver_phone')::text AS driver_phone,
            (rec->>'loading_location')::text AS loading_location,
            (rec->>'unloading_location')::text AS unloading_location,
            -- 时区修复：前端发送的日期字符串（YYYY-MM-DD）应该被理解为中国时区的日期
            -- 需要明确转换为中国时区的timestamptz，然后PostgreSQL自动转换为UTC存储
            -- 例如：'2025-11-03' -> '2025-11-03 00:00:00+08:00' -> '2025-11-02 16:00:00+00:00' (UTC)
            ((rec->>'loading_date')::text || ' 00:00:00+08:00')::timestamptz AS loading_date,
            ((COALESCE(NULLIF(rec->>'unloading_date', ''), rec->>'loading_date'))::text || ' 00:00:00+08:00')::timestamptz AS unloading_date,
            NULLIF(rec->>'loading_weight', '')::numeric AS loading_weight,
            NULLIF(rec->>'unloading_weight', '')::numeric AS unloading_weight,
            COALESCE((rec->>'current_cost')::numeric, 0) AS current_cost,
            COALESCE((rec->>'extra_cost')::numeric, 0) AS extra_cost,
            COALESCE(rec->>'transport_type', '实际运输')::text AS transport_type,
            (rec->>'remarks')::text AS remarks,
            (rec->>'chain_name')::text AS chain_name,
            -- 数组类型修复：处理外部运单号 - 将 JSONB 数组转换为 text[] 数组
            CASE 
                WHEN rec->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(rec->'external_tracking_numbers') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(rec->'external_tracking_numbers') AS value WHERE value::text != '')
                WHEN rec->>'external_tracking_numbers' IS NOT NULL AND rec->>'external_tracking_numbers' != '' THEN
                    string_to_array(rec->>'external_tracking_numbers', ',')
                ELSE 
                    '{}'::text[]
            END AS external_tracking_numbers,
            -- 数组类型修复：处理其他平台名称 - 将 JSONB 数组转换为 text[] 数组
            CASE 
                WHEN rec->'other_platform_names' IS NOT NULL AND jsonb_array_length(rec->'other_platform_names') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(rec->'other_platform_names') AS value WHERE value::text != '')
                WHEN rec->>'other_platform_names' IS NOT NULL AND rec->>'other_platform_names' != '' THEN
                    string_to_array(rec->>'other_platform_names', ',')
                ELSE 
                    '{}'::text[]
            END AS other_platform_names,
            ROW_NUMBER() OVER(PARTITION BY (rec->>'loading_date')::date ORDER BY (rec->>'driver_name')) AS daily_row_num
        FROM jsonb_array_elements(p_records) AS rec
    ),
    -- 步骤2: 获取项目信息，用于关联司机和地点
    projects_info AS (
        SELECT DISTINCT pd.project_name, p.id as project_id
        FROM parsed_data pd
        JOIN public.projects p ON pd.project_name = p.name
    ),
    -- 步骤3: 批量创建本次导入需要用到的所有"司机"，确保关联到正确的项目
    inserted_drivers AS (
        INSERT INTO public.drivers (name, license_plate, phone, user_id)
        SELECT DISTINCT driver_name, license_plate, driver_phone, auth.uid() FROM parsed_data
        ON CONFLICT (name, license_plate) DO NOTHING
    ),
    -- 步骤4: 为司机关联项目（确保司机与项目的关联）
    driver_project_links AS (
        INSERT INTO public.driver_projects (driver_id, project_id, user_id)
        SELECT DISTINCT d.id, pi.project_id, auth.uid()
        FROM parsed_data pd
        JOIN projects_info pi ON pd.project_name = pi.project_name
        JOIN public.drivers d ON pd.driver_name = d.name AND pd.license_plate = d.license_plate
        ON CONFLICT (driver_id, project_id) DO NOTHING
    ),
    -- 步骤5: 批量创建本次导入需要用到的所有"地点"
    inserted_locations AS (
        INSERT INTO public.locations (name, user_id)
        SELECT DISTINCT location_name, auth.uid() FROM (
            SELECT loading_location AS location_name FROM parsed_data
            UNION
            SELECT unloading_location AS location_name FROM parsed_data
        ) AS all_locations
        ON CONFLICT (name) DO NOTHING
    ),
    -- 步骤6: 为地点关联项目（确保地点与项目的关联）
    location_project_links AS (
        INSERT INTO public.location_projects (location_id, project_id, user_id)
        SELECT DISTINCT l.id, pi.project_id, auth.uid()
        FROM (
            SELECT pd.project_name, pd.loading_location AS location_name FROM parsed_data pd
            UNION
            SELECT pd.project_name, pd.unloading_location AS location_name FROM parsed_data pd
        ) AS all_project_locations
        JOIN projects_info pi ON all_project_locations.project_name = pi.project_name
        JOIN public.locations l ON all_project_locations.location_name = l.name
        ON CONFLICT (location_id, project_id) DO NOTHING
    ),
    -- 步骤7: 查找每一天在数据库中已存在的最大运单序号
    -- 注意：需要将 loading_date 转换为 date 类型进行比较
    daily_max_sequence AS (
        SELECT
            d.loading_date::date AS loading_date,
            COALESCE(MAX(substring(lr.auto_number from 12)::integer), 0) AS max_seq
        FROM (SELECT DISTINCT loading_date::date AS loading_date FROM parsed_data) d
        LEFT JOIN public.logistics_records lr ON (lr.loading_date AT TIME ZONE 'UTC')::date = d.loading_date AND lr.auto_number LIKE 'YDN%'
        GROUP BY d.loading_date
    ),
    -- 步骤8: 关联所有数据，生成最终要插入的记录集合，包括billing_type_id和可选字段
    -- ✅ 修复：确保正确获取 billing_type_id
    final_records AS (
        SELECT
            'YDN' || to_char(pd.loading_date::date, 'YYYYMMDD') || '-' ||
            lpad((dms.max_seq + pd.daily_row_num)::text, 3, '0') AS auto_number,
            proj.id AS project_id,
            pd.project_name,
            pc.id AS chain_id,
            COALESCE(pc.billing_type_id, 1) AS billing_type_id, -- ✅ 获取链路的billing_type_id，如果不存在则默认为1（计吨）
            drv.id AS driver_id,
            pd.driver_name,
            pd.loading_location,
            pd.unloading_location,
            pd.loading_date,
            pd.unloading_date,
            pd.loading_weight,
            pd.unloading_weight,
            pd.current_cost,
            pd.extra_cost,
            pd.license_plate,
            pd.driver_phone,
            pd.transport_type,
            pd.remarks,
            (pd.current_cost + pd.extra_cost) AS payable_cost,
            auth.uid() AS created_by_user_id,
            -- 可选字段（已修复为 text[] 类型）
            pd.external_tracking_numbers,
            pd.other_platform_names
        FROM parsed_data pd
        INNER JOIN public.projects proj ON pd.project_name = proj.name
        INNER JOIN public.drivers drv ON pd.driver_name = drv.name AND pd.license_plate = drv.license_plate
        INNER JOIN daily_max_sequence dms ON pd.loading_date::date = dms.loading_date
        LEFT JOIN public.partner_chains pc ON pd.chain_name = pc.chain_name AND proj.id = pc.project_id
    ),
    -- 步骤9: 执行最终的批量插入
    inserted_logistics_records AS (
        INSERT INTO public.logistics_records (
            auto_number, project_id, project_name, chain_id, billing_type_id, driver_id, driver_name,
            loading_location, unloading_location, loading_date, unloading_date,
            loading_weight, unloading_weight, current_cost, extra_cost,
            license_plate, driver_phone, transport_type, remarks, payable_cost,
            created_by_user_id, external_tracking_numbers, other_platform_names
        )
        SELECT * FROM final_records
        ON CONFLICT (auto_number) DO NOTHING
        RETURNING id
    )
    SELECT array_agg(id) INTO v_inserted_ids FROM inserted_logistics_records;

    -- 步骤10: 批量触发成本更新计算
    IF array_length(v_inserted_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
    END IF;

    -- 步骤11: 计算并返回最终结果
    v_success_count := COALESCE(array_length(v_inserted_ids, 1), 0);
    v_error_count := jsonb_array_length(p_records) - v_success_count;
    
    -- 如果有错误，尝试找出失败的原因
    v_total_records := jsonb_array_length(p_records);
    
    -- 如果所有记录都失败了，尝试找出原因
    IF v_success_count = 0 AND v_error_count > 0 THEN
            -- 检查是否有项目不存在的问题
            WITH parsed_data AS (
                SELECT
                    (rec->>'project_name')::text AS project_name,
                    (rec->>'driver_name')::text AS driver_name,
                    (rec->>'license_plate')::text AS license_plate,
                    idx::integer AS record_index
                FROM jsonb_array_elements(p_records) WITH ORDINALITY AS t(rec, idx)
            ),
            missing_projects AS (
                SELECT DISTINCT pd.project_name, pd.record_index
                FROM parsed_data pd
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.projects p WHERE p.name = pd.project_name
                )
            ),
            missing_drivers AS (
                SELECT DISTINCT pd.driver_name, pd.license_plate, pd.record_index
                FROM parsed_data pd
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.drivers d 
                    WHERE d.name = pd.driver_name AND d.license_plate = pd.license_plate
                )
                AND NOT EXISTS (SELECT 1 FROM missing_projects mp WHERE mp.record_index = pd.record_index)
            )
            SELECT jsonb_agg(
                jsonb_build_object(
                    'record_index', COALESCE(mp.record_index, md.record_index),
                    'error_message', CASE 
                        WHEN mp.project_name IS NOT NULL THEN '项目不存在: ' || mp.project_name
                        WHEN md.driver_name IS NOT NULL THEN '司机不存在: ' || md.driver_name || ' (' || md.license_plate || ')'
                        ELSE '未知错误：记录未能插入'
                    END
                )
            ) INTO v_error_details
            FROM missing_projects mp
            FULL OUTER JOIN missing_drivers md ON mp.record_index = md.record_index
            LIMIT 10;  -- 限制最多返回10条错误详情，避免返回过多
            
            -- 如果错误详情为空，创建一个通用错误信息
            IF v_error_details IS NULL OR jsonb_array_length(v_error_details) = 0 THEN
                v_error_details := jsonb_build_array(
                    jsonb_build_object(
                        'record_index', 1,
                        'error_message', '批量导入失败：所有 ' || v_error_count || ' 条记录未能插入。可能的原因：项目不存在、司机不存在、数据格式错误等。请检查数据格式和必填字段。'
                    )
                );
            END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'error_details', COALESCE(v_error_details, '[]'::jsonb),
        'errors', COALESCE(v_error_details, '[]'::jsonb)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success_count', 0,
            'error_count', jsonb_array_length(p_records),
            'error_details', jsonb_build_array(
                jsonb_build_object(
                    'record_index', 1,
                    'error_message', '批量操作失败: ' || SQLERRM
                )
            ),
            'errors', jsonb_build_array(
                jsonb_build_object(
                    'record_index', 1,
                    'error_message', '批量操作失败: ' || SQLERRM
                )
            )
        );
END;
$$;

COMMENT ON FUNCTION public.batch_import_logistics_records_1208(jsonb) IS 
'批量导入运单记录，支持外部运单号和其他平台名称等可选字段（高性能 CTE 版本，已修复时区和数组类型）。
版本：1208
已修复：
1. ✅ 确保正确获取 billing_type_id
   - 如果合作链路存在，使用链路的 billing_type_id
   - 如果合作链路不存在或没有 billing_type_id，使用默认值 1（计吨）';

-- 验证
SELECT '✅ 函数已创建：batch_import_logistics_records_1208，已确保正确获取 billing_type_id' AS status;
