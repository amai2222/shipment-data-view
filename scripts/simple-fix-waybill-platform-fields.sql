-- 简单修复运单编辑和导入平台字段问题
-- 避免复杂查询，减少限流风险

-- 1. 检查并更新 get_logistics_summary_and_records 函数
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
    
    -- 获取分页记录（包含平台字段）
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', lr.id,
            'auto_number', lr.auto_number,
            'project_id', lr.project_id,
            'project_name', lr.project_name,
            'chain_id', lr.chain_id,
            'chain_name', lr.chain_name,
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

-- 2. 检查并更新 import_logistics_data 函数
CREATE OR REPLACE FUNCTION public.import_logistics_data(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    success_count integer := 0;
    failures jsonb := '[]'::jsonb;
    project_record record;
    driver_result record;
    loading_location_id uuid;
    unloading_location_id uuid;
    chain_id_val uuid;
    loading_date_formatted timestamp;
    unloading_date_formatted timestamp;
    new_record_id uuid;
    v_auto_number text;
    driver_payable numeric;
    effective_billing_type_id bigint;
    new_record_ids uuid[] := '{}';
    row_index integer := 0;
BEGIN
    -- 处理每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        row_index := row_index + 1;
        BEGIN
            -- 第1步：获取项目信息
            SELECT id, name, billing_type_id INTO project_record
            FROM public.projects 
            WHERE name = (record_data->>'project_name') 
            LIMIT 1;

            IF project_record.id IS NULL THEN
                failures := failures || jsonb_build_object(
                    'row_index', row_index,
                    'data', record_data,
                    'error', '项目不存在: ' || (record_data->>'project_name')
                );
                CONTINUE;
            END IF;
            
            -- 第2步：查找或创建司机
            SELECT id, name INTO driver_result
            FROM public.drivers
            WHERE name = TRIM(record_data->>'driver_name')
            AND license_plate = TRIM(record_data->>'license_plate')
            LIMIT 1;

            IF driver_result.id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id, name INTO driver_result;
            END IF;

            -- 第3步：获取或创建地点
            PERFORM public.get_or_create_locations_from_string(
                TRIM(record_data->>'loading_location') || '|' || TRIM(record_data->>'unloading_location')
            );

            -- 第4步：查找合作链路
            chain_id_val := NULL;
            effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
            
            IF (record_data->>'chain_name') IS NOT NULL AND (record_data->>'chain_name') != '' THEN
                SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                FROM public.partner_chains 
                WHERE project_id = project_record.id 
                  AND chain_name = (record_data->>'chain_name') 
                LIMIT 1;
                
                IF chain_id_val IS NULL THEN
                    effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
                END IF;
            END IF;

            -- 第5步：准备日期数据
            loading_date_formatted := (record_data->>'loading_date')::timestamp;
            unloading_date_formatted := COALESCE(
                NULLIF(record_data->>'unloading_date', ''),
                record_data->>'loading_date'
            )::timestamp;
            
            -- 第6步：生成运单编号
            v_auto_number := 'YDN' || to_char(loading_date_formatted, 'YYYYMMDD') || '-' ||
                           lpad((
                               COALESCE(
                                   (SELECT MAX(substring(auto_number from 12)::integer) + 1
                                    FROM public.logistics_records 
                                    WHERE loading_date::date = loading_date_formatted::date 
                                      AND auto_number LIKE 'YDN%'), 
                                   1
                               )
                           )::text, 3, '0');
            
            -- 第7步：计算应付费用
            driver_payable := COALESCE((record_data->>'current_cost')::numeric, 0) + 
                             COALESCE((record_data->>'extra_cost')::numeric, 0);

            -- 第8步：插入运单记录（包含平台字段）
            INSERT INTO public.logistics_records (
                auto_number, project_id, project_name, chain_id, billing_type_id,
                driver_id, driver_name, loading_location, unloading_location,
                loading_date, unloading_date, loading_weight, unloading_weight,
                current_cost, extra_cost, license_plate, driver_phone,
                transport_type, remarks, payable_cost, created_by_user_id, user_id,
                external_tracking_numbers, other_platform_names
            ) VALUES (
                v_auto_number, project_record.id, project_record.name, chain_id_val, effective_billing_type_id,
                driver_result.id, driver_result.name, (record_data->>'loading_location'), (record_data->>'unloading_location'),
                loading_date_formatted, unloading_date_formatted,
                NULLIF((record_data->>'loading_weight')::text, '')::numeric,
                NULLIF((record_data->>'unloading_weight')::text, '')::numeric,
                COALESCE((record_data->>'current_cost')::numeric, 0),
                COALESCE((record_data->>'extra_cost')::numeric, 0),
                (record_data->>'license_plate'), (record_data->>'driver_phone'),
                COALESCE((record_data->>'transport_type'), '实际运输'),
                (record_data->>'remarks'), driver_payable, auth.uid(), auth.uid(),
                -- 插入平台字段
                CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                     THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                     THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
            ) RETURNING id INTO new_record_id;

            -- 收集成功导入的记录ID
            new_record_ids := array_append(new_record_ids, new_record_id);
            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            failures := failures || jsonb_build_object(
                'row_index', row_index,
                'data', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 第9步：批量计算合作方成本
    IF array_length(new_record_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(new_record_ids);
    END IF;

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', success_count,
        'failures', failures
    );
END;
$$;

-- 3. 添加函数注释
COMMENT ON FUNCTION public.get_logistics_summary_and_records(text, text, text, text, text, text, integer, integer) IS '获取运单汇总和记录，包含平台字段';
COMMENT ON FUNCTION public.import_logistics_data(jsonb) IS '导入运单数据，支持平台字段';
