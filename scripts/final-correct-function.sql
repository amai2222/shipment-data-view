-- 最终正确的函数定义
-- 基于原始工作版本，只添加平台字段支持

-- 1. 完全正确的 get_logistics_summary_and_records 函数
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
AS $$
DECLARE
    v_offset integer;
    v_result jsonb;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_records AS (
        SELECT lr.*,
               pc.chain_name
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%') AND
            (p_license_plate IS NULL OR p_license_plate = '' OR lr.license_plate ILIKE '%' || p_license_plate || '%') AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR lr.driver_phone ILIKE '%' || p_driver_phone || '%')
    )
    SELECT jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'totalLoadingWeight', COALESCE(SUM(loading_weight), 0),
                'totalUnloadingWeight', COALESCE(SUM(unloading_weight), 0),
                'totalCurrentCost', COALESCE(SUM(current_cost), 0),
                'totalExtraCost', COALESCE(SUM(extra_cost), 0),
                'totalDriverPayableCost', COALESCE(SUM(payable_cost), 0),
                'actualCount', COUNT(*) FILTER (WHERE transport_type = '实际运输'),
                'returnCount', COUNT(*) FILTER (WHERE transport_type = '退货')
            )
            FROM filtered_records
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', fr.id,
                    'auto_number', fr.auto_number,
                    'project_id', fr.project_id,
                    'project_name', fr.project_name,
                    'chain_id', fr.chain_id,
                    'chain_name', fr.chain_name,
                    'billing_type_id', fr.billing_type_id,
                    'driver_id', fr.driver_id,
                    'driver_name', fr.driver_name,
                    'loading_location', fr.loading_location,
                    'unloading_location', fr.unloading_location,
                    'loading_date', fr.loading_date,
                    'unloading_date', fr.unloading_date,
                    'loading_weight', fr.loading_weight,
                    'unloading_weight', fr.unloading_weight,
                    'current_cost', fr.current_cost,
                    'payable_cost', fr.payable_cost,
                    'driver_payable_cost', fr.driver_payable_cost,
                    'license_plate', fr.license_plate,
                    'driver_phone', fr.driver_phone,
                    'transport_type', fr.transport_type,
                    'extra_cost', fr.extra_cost,
                    'remarks', fr.remarks,
                    'external_tracking_numbers', fr.external_tracking_numbers,
                    'other_platform_names', fr.other_platform_names,
                    'created_at', fr.created_at
                )
                ORDER BY fr.loading_date DESC, fr.created_at DESC
            ), '[]'::jsonb)
            FROM (
                SELECT *
                FROM filtered_records
                ORDER BY loading_date DESC, created_at DESC
                LIMIT p_page_size
                OFFSET v_offset
            ) fr
        ),
        'count', (SELECT COUNT(*) FROM filtered_records)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

-- 2. 确保 import_logistics_data 函数正确
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

-- 3. 测试函数
DO $$
DECLARE
    result jsonb;
BEGIN
    RAISE NOTICE '=== 测试最终正确的函数 ===';
    
    BEGIN
        result := public.get_logistics_summary_and_records();
        RAISE NOTICE '✓ 函数执行成功';
        RAISE NOTICE '记录数量: %', (result->>'count')::integer;
        
        -- 检查返回结构
        IF result ? 'records' AND result ? 'summary' AND result ? 'count' THEN
            RAISE NOTICE '✓ 返回结构正确';
        ELSE
            RAISE NOTICE '✗ 返回结构错误';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 函数测试失败: %', SQLERRM;
    END;
    
    RAISE NOTICE '=== 测试完成 ===';
END $$;
