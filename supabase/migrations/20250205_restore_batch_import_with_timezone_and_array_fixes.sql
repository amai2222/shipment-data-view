-- ============================================================================
-- 恢复高性能批量导入函数，保留时区和数组类型修复
-- 恢复时间: 2025-02-05
-- 
-- 说明：
-- 1. 恢复备份文件中的 CTE 批量处理版本（高性能）
-- 2. 保留时区修复：日期字符串转换为 ' 00:00:00+08:00' 然后存储为 UTC
-- 3. 保留数组类型修复：external_tracking_numbers 和 other_platform_names 正确处理为 text[]
-- ============================================================================

-- ============================================================================
-- 函数 1: batch_import_logistics_records
-- 描述: 标准批量导入函数（高性能 CTE 版本，支持外部运单号和其他平台名称）
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
    final_records AS (
        SELECT
            'YDN' || to_char(pd.loading_date::date, 'YYYYMMDD') || '-' ||
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

COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS '批量导入运单记录，支持外部运单号和其他平台名称等可选字段（高性能 CTE 版本，已修复时区和数组类型）';

-- 完成提示
SELECT '批量导入函数已恢复为高性能 CTE 版本，并应用了时区和数组类型修复！' as message;

