-- 修复 import_logistics_data 函数中的列引用歧义问题
CREATE OR REPLACE FUNCTION public.import_logistics_data(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
    v_success_count integer := 0;
    v_failures jsonb := '[]'::jsonb;
    v_record_data jsonb;
    v_project_id uuid;
    v_driver_id uuid;
    v_chain_id uuid;
    v_loading_location_id uuid;
    v_unloading_location_id uuid;
    v_auto_number text;
    v_daily_seq integer;
    v_new_record_id uuid;
    v_error_message text;
    v_billing_type_id bigint;
BEGIN
    -- 遍历每条记录进行处理
    FOR v_record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 验证必填字段
            IF (v_record_data->>'project_name') IS NULL OR 
               (v_record_data->>'driver_name') IS NULL OR 
               (v_record_data->>'loading_location') IS NULL OR 
               (v_record_data->>'loading_date') IS NULL THEN
                v_failures := v_failures || jsonb_build_object(
                    'row_index', v_success_count + jsonb_array_length(v_failures) + 1,
                    'data', v_record_data,
                    'error', '缺少必填字段'
                );
                CONTINUE;
            END IF;

            -- 获取项目ID
            SELECT p.id INTO v_project_id 
            FROM public.projects p
            WHERE p.name = (v_record_data->>'project_name');
            
            IF v_project_id IS NULL THEN
                v_failures := v_failures || jsonb_build_object(
                    'row_index', v_success_count + jsonb_array_length(v_failures) + 1,
                    'data', v_record_data,
                    'error', '项目不存在'
                );
                CONTINUE;
            END IF;

            -- 获取或创建司机，并确保关联到项目
            SELECT goc.driver_id INTO v_driver_id 
            FROM public.get_or_create_driver_with_project(
                (v_record_data->>'driver_name'),
                (v_record_data->>'license_plate'),
                (v_record_data->>'driver_phone'),
                v_project_id
            ) goc;

            -- 获取或创建装货地点，并确保关联到项目
            SELECT public.get_or_create_location(
                (v_record_data->>'loading_location'),
                v_project_id
            ) INTO v_loading_location_id;

            -- 获取或创建卸货地点，并确保关联到项目
            SELECT public.get_or_create_location(
                (v_record_data->>'unloading_location'),
                v_project_id
            ) INTO v_unloading_location_id;

            -- 获取合作链路ID（如果指定）
            v_chain_id := NULL;
            IF (v_record_data->>'chain_name') IS NOT NULL AND (v_record_data->>'chain_name') != '' THEN
                SELECT pc.id INTO v_chain_id 
                FROM public.partner_chains pc
                WHERE pc.project_id = v_project_id AND pc.chain_name = (v_record_data->>'chain_name');
            END IF;
            
            -- 如果没有指定链路或链路不存在，使用默认链路
            IF v_chain_id IS NULL THEN
                SELECT pc.id INTO v_chain_id 
                FROM public.partner_chains pc
                WHERE pc.project_id = v_project_id AND pc.is_default = true
                LIMIT 1;
            END IF;

            -- 获取billing_type_id
            IF v_chain_id IS NOT NULL THEN
                SELECT pc.billing_type_id INTO v_billing_type_id
                FROM public.partner_chains pc
                WHERE pc.id = v_chain_id;
            END IF;
            v_billing_type_id := COALESCE(v_billing_type_id, 1);

            -- 生成运单编号
            SELECT COALESCE(MAX(substring(lr.auto_number from 12)::integer), 0) + 1
            INTO v_daily_seq
            FROM public.logistics_records lr
            WHERE lr.loading_date::date = (v_record_data->>'loading_date')::date
            AND lr.auto_number LIKE 'YDN%';

            v_auto_number := 'YDN' || to_char((v_record_data->>'loading_date')::date, 'YYYYMMDD') || '-' || 
                           lpad(v_daily_seq::text, 3, '0');

            -- 插入运单记录
            INSERT INTO public.logistics_records (
                auto_number, project_id, project_name, chain_id, billing_type_id,
                driver_id, driver_name, loading_location, unloading_location,
                loading_date, unloading_date, loading_weight, unloading_weight,
                current_cost, extra_cost, payable_cost,
                license_plate, driver_phone, transport_type, remarks,
                created_by_user_id, user_id
            ) VALUES (
                v_auto_number,
                v_project_id,
                (v_record_data->>'project_name'),
                v_chain_id,
                v_billing_type_id,
                v_driver_id,
                (v_record_data->>'driver_name'),
                (v_record_data->>'loading_location'),
                (v_record_data->>'unloading_location'),
                (v_record_data->>'loading_date')::timestamp,
                COALESCE((v_record_data->>'unloading_date')::timestamp, (v_record_data->>'loading_date')::timestamp),
                NULLIF(v_record_data->>'loading_weight', '')::numeric,
                NULLIF(v_record_data->>'unloading_weight', '')::numeric,
                COALESCE(NULLIF(v_record_data->>'current_cost', '')::numeric, 0),
                COALESCE(NULLIF(v_record_data->>'extra_cost', '')::numeric, 0),
                COALESCE(NULLIF(v_record_data->>'current_cost', '')::numeric, 0) + COALESCE(NULLIF(v_record_data->>'extra_cost', '')::numeric, 0),
                (v_record_data->>'license_plate'),
                (v_record_data->>'driver_phone'),
                COALESCE((v_record_data->>'transport_type'), '实际运输'),
                (v_record_data->>'remarks'),
                auth.uid(),
                auth.uid()
            ) RETURNING id INTO v_new_record_id;

            -- 计算并插入合作方成本
            PERFORM public.recalculate_and_update_costs_for_record(v_new_record_id);

            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_message := SQLERRM;
            v_failures := v_failures || jsonb_build_object(
                'row_index', v_success_count + jsonb_array_length(v_failures) + 1,
                'data', v_record_data,
                'error', v_error_message
            );
        END;
    END LOOP;

    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'failures', v_failures
    );
END;
$function$;