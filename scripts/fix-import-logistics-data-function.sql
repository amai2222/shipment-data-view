-- 修复 import_logistics_data 函数中的 billing_type_id 字段问题
-- 确保函数正确处理 billing_type_id 字段

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
            -- 第1步：获取项目信息（包括billing_type_id）
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
            
            -- 第2步：查找或创建司机（根据姓名+车牌+电话三个字段）
            SELECT id, name INTO driver_result
            FROM public.drivers
            WHERE name = (record_data->>'driver_name')
              AND COALESCE(license_plate, '') = COALESCE(record_data->>'license_plate', '')
              AND COALESCE(phone, '') = COALESCE(record_data->>'driver_phone', '')
            LIMIT 1;
            
            -- 如果司机不存在，创建新司机
            IF driver_result.id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    (record_data->>'driver_name'),
                    (record_data->>'license_plate'),
                    (record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id, name INTO driver_result;
                
                -- 关联司机与项目
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (driver_result.id, project_record.id, auth.uid())
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END IF;
            
            -- 第3步：查找或创建装货地点
            SELECT id INTO loading_location_id
            FROM public.locations
            WHERE name = (record_data->>'loading_location')
            LIMIT 1;
            
            IF loading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES ((record_data->>'loading_location'), auth.uid())
                RETURNING id INTO loading_location_id;
            END IF;
            
            -- 第4步：查找或创建卸货地点
            SELECT id INTO unloading_location_id
            FROM public.locations
            WHERE name = (record_data->>'unloading_location')
            LIMIT 1;
            
            IF unloading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES ((record_data->>'unloading_location'), auth.uid())
                RETURNING id INTO unloading_location_id;
            END IF;
            
            -- 第5步：处理合作链路和billing_type_id
            effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
            
            IF (record_data->>'chain_name') IS NOT NULL AND (record_data->>'chain_name') != '' THEN
                SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                FROM public.partner_chains
                WHERE chain_name = (record_data->>'chain_name') AND project_id = project_record.id
                LIMIT 1;
                
                IF chain_id_val IS NULL THEN
                    effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
                END IF;
            ELSE
                chain_id_val := NULL;
                effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
            END IF;
            
            -- 第6步：格式化日期
            loading_date_formatted := (record_data->>'loading_date')::timestamp;
            unloading_date_formatted := COALESCE(
                NULLIF((record_data->>'unloading_date'), '')::timestamp,
                loading_date_formatted
            );
            
            -- 第7步：生成运单号
            v_auto_number := 'YDN' || to_char(loading_date_formatted, 'YYYYMMDD') || '-' ||
                            lpad((SELECT COALESCE(MAX(
                                CASE 
                                    WHEN auto_number ~ '^YDN\d{8}-\d{3}$' 
                                    THEN (substring(auto_number from 12 for 3))::integer 
                                    ELSE 0 
                                END
                            ), 0) + row_index FROM public.logistics_records 
                            WHERE loading_date::date = loading_date_formatted::date)::text, 3, '0');
            
            -- 第8步：计算司机应收
            driver_payable := COALESCE((record_data->>'current_cost')::numeric, 0) + 
                            COALESCE((record_data->>'extra_cost')::numeric, 0);
            
            -- 第9步：插入运单记录
            INSERT INTO public.logistics_records (
                auto_number, project_id, project_name, chain_id, billing_type_id,
                driver_id, driver_name, loading_location, unloading_location,
                loading_date, unloading_date, loading_weight, unloading_weight,
                current_cost, extra_cost, license_plate, driver_phone,
                transport_type, remarks, payable_cost, created_by_user_id, user_id
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
                (record_data->>'remarks'), driver_payable, auth.uid(), auth.uid()
            ) RETURNING id INTO new_record_id;

            -- 收集成功导入的记录ID，用于批量计算成本
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

    -- 第10步：批量计算合作方成本
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

-- 为函数添加注释
COMMENT ON FUNCTION public.import_logistics_data(jsonb) IS '修复后的智能导入函数，正确处理billing_type_id字段';

-- 完成提示
SELECT 'import_logistics_data 函数已修复，billing_type_id 字段错误已解决！' as message;
