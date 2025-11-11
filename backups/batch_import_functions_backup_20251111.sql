-- ============================================================================
-- 数据库函数备份
-- 备份时间: 2025-11-11
-- 备份原因: 执行时区修复和数组类型修复前的备份
-- 
-- 备份的函数：
-- 1. batch_import_logistics_records - 标准批量导入函数
-- 2. batch_import_logistics_records_with_update - 支持更新模式的批量导入函数
-- 3. preview_import_with_update_mode - 预览导入数据（支持更新模式）
-- 4. preview_import_with_duplicates_check - 预览导入数据（重复检查）
-- ============================================================================

-- ============================================================================
-- 函数 1: batch_import_logistics_records
-- 描述: 标准批量导入函数（最新版本，支持外部运单号和其他平台名称）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_ids uuid[];
    v_success_count integer;
    v_error_count integer;
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
            (rec->>'loading_date')::date AS loading_date,
            COALESCE(NULLIF(rec->>'unloading_date', ''), rec->>'loading_date')::date AS unloading_date,
            NULLIF(rec->>'loading_weight', '')::numeric AS loading_weight,
            NULLIF(rec->>'unloading_weight', '')::numeric AS unloading_weight,
            COALESCE((rec->>'current_cost')::numeric, 0) AS current_cost,
            COALESCE((rec->>'extra_cost')::numeric, 0) AS extra_cost,
            COALESCE(rec->>'transport_type', '实际运输')::text AS transport_type,
            (rec->>'remarks')::text AS remarks,
            (rec->>'chain_name')::text AS chain_name,
            -- 处理可选字段：外部运单号
            CASE 
                WHEN rec->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(rec->'external_tracking_numbers') > 0 THEN
                    rec->'external_tracking_numbers'
                ELSE NULL
            END AS external_tracking_numbers,
            -- 处理可选字段：其他平台名称
            CASE 
                WHEN rec->'other_platform_names' IS NOT NULL AND jsonb_array_length(rec->'other_platform_names') > 0 THEN
                    (SELECT array_agg(value::text) FROM jsonb_array_elements_text(rec->'other_platform_names') WHERE value::text != '')
                ELSE NULL
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
    daily_max_sequence AS (
        SELECT
            d.loading_date,
            COALESCE(MAX(substring(lr.auto_number from 12)::integer), 0) AS max_seq
        FROM (SELECT DISTINCT loading_date FROM parsed_data) d
        LEFT JOIN public.logistics_records lr ON lr.loading_date = d.loading_date AND lr.auto_number LIKE 'YDN%'
        GROUP BY d.loading_date
    ),
    -- 步骤8: 关联所有数据，生成最终要插入的记录集合，包括billing_type_id和可选字段
    final_records AS (
        SELECT
            'YDN' || to_char(pd.loading_date, 'YYYYMMDD') || '-' ||
            lpad((dms.max_seq + pd.daily_row_num)::text, 3, '0') AS auto_number,
            proj.id AS project_id,
            pd.project_name,
            pc.id AS chain_id,
            COALESCE(pc.billing_type_id, 1) AS billing_type_id, -- 获取链路的billing_type_id
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
            -- 可选字段
            pd.external_tracking_numbers,
            pd.other_platform_names
        FROM parsed_data pd
        INNER JOIN public.projects proj ON pd.project_name = proj.name
        INNER JOIN public.drivers drv ON pd.driver_name = drv.name AND pd.license_plate = drv.license_plate
        INNER JOIN daily_max_sequence dms ON pd.loading_date = dms.loading_date
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

    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'errors', '[]'::jsonb
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success_count', 0,
            'error_count', jsonb_array_length(p_records),
            'errors', jsonb_build_object('error', 'Batch operation failed: ' || SQLERRM)
        );
END;
$$;

COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS '批量导入运单记录，支持外部运单号和其他平台名称等可选字段';

-- ============================================================================
-- 函数 2: batch_import_logistics_records_with_update
-- 描述: 批量导入函数，支持更新模式
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
    update_result record;
BEGIN
    -- 处理每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_record_index := v_record_index + 1;
        BEGIN
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
                WHERE name = TRIM(record_data->>'chain_name')
                AND project_id = project_id_val
                LIMIT 1;

                IF chain_id_val IS NULL THEN
                    INSERT INTO public.partner_chains (name, project_id, user_id)
                    VALUES (TRIM(record_data->>'chain_name'), project_id_val, auth.uid())
                    RETURNING id INTO chain_id_val;
                END IF;
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
            END IF;

            -- 4. 检查是否存在重复记录
            SELECT id INTO existing_record_id
            FROM public.logistics_records
            WHERE project_name = TRIM(record_data->>'project_name')
            AND driver_name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            AND loading_location = TRIM(record_data->>'loading_location')
            AND unloading_location = TRIM(record_data->>'unloading_location')
            AND loading_date = (record_data->>'loading_date')::timestamptz
            AND loading_weight = (record_data->>'loading_weight')::numeric;

            IF existing_record_id IS NOT NULL AND p_update_mode THEN
                -- 更新模式：更新现有记录
                UPDATE public.logistics_records SET
                    project_id = project_id_val,
                    project_name = TRIM(record_data->>'project_name'),
                    chain_id = chain_id_val,
                    driver_id = driver_id_val,
                    driver_name = TRIM(record_data->>'driver_name'),
                    license_plate = TRIM(record_data->>'license_plate'),
                    driver_phone = TRIM(record_data->>'driver_phone'),
                    loading_location = TRIM(record_data->>'loading_location'),
                    unloading_location = TRIM(record_data->>'unloading_location'),
                    loading_date = (record_data->>'loading_date')::timestamptz,
                    unloading_date = CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                                         THEN (record_data->>'unloading_date')::timestamptz ELSE NULL END,
                    loading_weight = (record_data->>'loading_weight')::numeric,
                    unloading_weight = CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                                           THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    current_cost = CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                                       THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    extra_cost = CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                                     THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    transport_type = COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    remarks = TRIM(record_data->>'remarks'),
                    external_tracking_numbers = CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                                                     THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                    other_platform_names = CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                                               THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
                WHERE id = existing_record_id
                RETURNING id INTO update_result.id;

                v_updated_ids := v_updated_ids || existing_record_id;
                v_update_count := v_update_count + 1;

                -- 重新计算成本
                PERFORM public.recalculate_and_update_costs_for_record(existing_record_id);

            ELSE
                -- 创建模式：创建新记录
                auto_number_val := public.generate_auto_number(record_data->>'loading_date');

                INSERT INTO public.logistics_records (
                    auto_number, project_id, project_name, loading_date, loading_location, 
                    unloading_location, driver_id, driver_name, license_plate, driver_phone,
                    loading_weight, unloading_date, unloading_weight, transport_type,
                    current_cost, extra_cost, payable_cost, remarks, created_by_user_id,
                    chain_id, external_tracking_numbers, other_platform_names
                ) VALUES (
                    auto_number_val, project_id_val, TRIM(record_data->>'project_name'),
                    (record_data->>'loading_date')::timestamptz, TRIM(record_data->>'loading_location'),
                    TRIM(record_data->>'unloading_location'), driver_id_val, TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'), TRIM(record_data->>'driver_phone'),
                    (record_data->>'loading_weight')::numeric, 
                    CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                         THEN (record_data->>'unloading_date')::timestamptz ELSE NULL END,
                    CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                         THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                    COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                    CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                         THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                    CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                         THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                    0, -- payable_cost 将在后续计算
                    TRIM(record_data->>'remarks'),
                    auth.uid(),
                    chain_id_val,
                    CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                         THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                    CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                         THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
                )
                RETURNING id INTO inserted_record_id;

                v_inserted_ids := v_inserted_ids || inserted_record_id;

                -- 重新计算成本
                PERFORM public.recalculate_and_update_costs_for_record(inserted_record_id);
            END IF;

            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_error_details := v_error_details || jsonb_build_object(
                'record_index', v_record_index,
                'error_message', SQLERRM,
                'record_data', record_data
            );
            RAISE NOTICE '处理记录失败: %', SQLERRM;
        END;
    END LOOP;

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'inserted_count', array_length(v_inserted_ids, 1),
        'updated_count', v_update_count,
        'inserted_ids', v_inserted_ids,
        'updated_ids', v_updated_ids,
        'error_details', v_error_details
    );
END;
$$;

COMMENT ON FUNCTION public.batch_import_logistics_records_with_update(jsonb, boolean) IS '批量导入运单记录，支持更新模式';

-- ============================================================================
-- 函数 3: preview_import_with_update_mode
-- 描述: 预览导入数据，支持更新模式分类
-- ============================================================================
CREATE OR REPLACE FUNCTION public.preview_import_with_update_mode(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_records_json jsonb := '[]'::jsonb;
    update_records_json jsonb := '[]'::jsonb;
    error_records_json jsonb := '[]'::jsonb;
    record_data jsonb;
    existing_record_id uuid;
    existing_auto_number text;
    is_duplicate boolean;
    processed_record jsonb;
BEGIN
    -- 遍历每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 1. 基本字段验证
            IF NOT (record_data ? 'project_name' AND record_data ? 'driver_name' AND 
                   record_data ? 'license_plate' AND record_data ? 'loading_location' AND 
                   record_data ? 'unloading_location' AND record_data ? 'loading_date' AND 
                   record_data ? 'loading_weight') THEN
                error_records_json := error_records_json || jsonb_build_object(
                    'record', record_data,
                    'error', '缺少必填字段'
                );
                CONTINUE;
            END IF;

            -- 2. 检查是否存在重复记录（基于8个关键字段）
            SELECT 
                lr.id,
                lr.auto_number,
                CASE WHEN EXISTS (
                    SELECT 1 FROM public.logistics_records lr2
                    WHERE lr2.project_name = TRIM(record_data->>'project_name')
                    AND lr2.driver_name = TRIM(record_data->>'driver_name')
                    AND lr2.license_plate = TRIM(record_data->>'license_plate')
                    AND lr2.loading_location = TRIM(record_data->>'loading_location')
                    AND lr2.unloading_location = TRIM(record_data->>'unloading_location')
                    AND lr2.loading_date = (record_data->>'loading_date')::timestamptz
                    AND lr2.loading_weight = (record_data->>'loading_weight')::numeric
                    AND lr2.id != lr.id
                ) THEN true ELSE false END
            INTO existing_record_id, existing_auto_number, is_duplicate
            FROM public.logistics_records lr
            WHERE lr.project_name = TRIM(record_data->>'project_name')
            AND lr.driver_name = TRIM(record_data->>'driver_name')
            AND lr.license_plate = TRIM(record_data->>'license_plate')
            AND lr.loading_location = TRIM(record_data->>'loading_location')
            AND lr.unloading_location = TRIM(record_data->>'unloading_location')
            AND lr.loading_date = (record_data->>'loading_date')::timestamptz
            AND lr.loading_weight = (record_data->>'loading_weight')::numeric
            LIMIT 1;

            -- 3. 构建处理后的记录，包含所有字段
            processed_record := jsonb_build_object(
                'project_name', TRIM(record_data->>'project_name'),
                'chain_name', TRIM(record_data->>'chain_name'),
                'driver_name', TRIM(record_data->>'driver_name'),
                'license_plate', TRIM(record_data->>'license_plate'),
                'driver_phone', TRIM(record_data->>'driver_phone'),
                'loading_location', TRIM(record_data->>'loading_location'),
                'unloading_location', TRIM(record_data->>'unloading_location'),
                'loading_date', record_data->>'loading_date',
                'unloading_date', record_data->>'unloading_date',
                'loading_weight', record_data->>'loading_weight',
                'unloading_weight', record_data->>'unloading_weight',
                'current_cost', record_data->>'current_cost',
                'extra_cost', record_data->>'extra_cost',
                'transport_type', record_data->>'transport_type',
                'remarks', record_data->>'remarks',
                'external_tracking_numbers', record_data->'external_tracking_numbers',
                'other_platform_names', record_data->'other_platform_names'
            );

            -- 4. 分类记录
            IF existing_record_id IS NOT NULL THEN
                -- 存在重复记录，标记为更新
                update_records_json := update_records_json || jsonb_build_object(
                    'record', processed_record,
                    'existing_record_id', existing_record_id,
                    'existing_auto_number', existing_auto_number
                );
            ELSE
                -- 不存在重复记录，标记为新记录
                new_records_json := new_records_json || jsonb_build_object('record', processed_record);
            END IF;

        EXCEPTION WHEN OTHERS THEN
            error_records_json := error_records_json || jsonb_build_object(
                'record', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 5. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'update_records', update_records_json,
        'error_records', error_records_json
    );
END;
$$;

COMMENT ON FUNCTION public.preview_import_with_update_mode(jsonb) IS '预览导入数据，支持更新模式分类';

-- ============================================================================
-- 备份说明
-- ============================================================================
-- 此备份包含了以下函数的当前版本：
-- 1. batch_import_logistics_records - 使用CTE批量处理的高性能版本
-- 2. batch_import_logistics_records_with_update - 支持更新模式的版本
-- 3. preview_import_with_update_mode - 预览更新模式的辅助函数
--
-- 如需恢复，请执行此备份文件
-- 
-- 备份时间: 2025-11-11
-- ============================================================================

