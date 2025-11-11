-- 修复 batch_import_logistics_records 函数中的数组字段类型转换错误
-- 问题：变量声明为 jsonb，但数据库字段是 text[] 类型
-- 修复：将 JSONB 数组转换为 text[] 数组

CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_errors jsonb := '[]'::jsonb;
    record_data jsonb;
    v_auto_number text;
    v_project_id uuid;
    v_driver_id uuid;
    v_chain_id uuid;
    v_loading_date_formatted text;
    v_unloading_date_formatted text;
    v_new_record_id uuid;
    v_driver_payable numeric;
    -- 修复：将变量类型改为 text[]，而不是 jsonb
    v_external_tracking_numbers text[];
    v_other_platform_names text[];
    v_error_message text;
BEGIN
    -- 逐条处理记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 提取基本字段
            v_loading_date_formatted := (record_data->>'loading_date')::text;
            v_unloading_date_formatted := COALESCE(NULLIF(record_data->>'unloading_date', ''), record_data->>'loading_date')::text;
            
            -- 修复：处理外部跟踪号 - 将 JSONB 数组转换为 text[] 数组
            IF record_data->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(record_data->'external_tracking_numbers') > 0 THEN
                -- 如果前端传递的是 JSONB 数组，转换为 text[] 数组
                SELECT array_agg(value::text) INTO v_external_tracking_numbers
                FROM jsonb_array_elements_text(record_data->'external_tracking_numbers')
                WHERE value::text != '';
                
                -- 如果转换后为空，设置为空数组
                IF v_external_tracking_numbers IS NULL THEN
                    v_external_tracking_numbers := '{}'::text[];
                END IF;
            ELSIF record_data->>'external_tracking_numbers' IS NOT NULL AND record_data->>'external_tracking_numbers' != '' THEN
                -- 如果前端传递的是逗号分隔的字符串，转换为 text[] 数组
                v_external_tracking_numbers := string_to_array(record_data->>'external_tracking_numbers', ',');
            ELSE
                v_external_tracking_numbers := '{}'::text[];
            END IF;
            
            -- 修复：处理平台名称 - 将 JSONB 数组转换为 text[] 数组
            IF record_data->'other_platform_names' IS NOT NULL AND jsonb_array_length(record_data->'other_platform_names') > 0 THEN
                -- 如果前端传递的是 JSONB 数组，转换为 text[] 数组
                SELECT array_agg(value::text) INTO v_other_platform_names
                FROM jsonb_array_elements_text(record_data->'other_platform_names')
                WHERE value::text != '';
                
                -- 如果转换后为空，设置为空数组
                IF v_other_platform_names IS NULL THEN
                    v_other_platform_names := '{}'::text[];
                END IF;
            ELSIF record_data->>'other_platform_names' IS NOT NULL AND record_data->>'other_platform_names' != '' THEN
                -- 如果前端传递的是逗号分隔的字符串，转换为 text[] 数组
                v_other_platform_names := string_to_array(record_data->>'other_platform_names', ',');
            ELSE
                v_other_platform_names := '{}'::text[];
            END IF;
            
            -- 1. 查找或创建项目
            SELECT id INTO v_project_id 
            FROM public.projects 
            WHERE name = (record_data->>'project_name')::text;
            
            IF v_project_id IS NULL THEN
                v_error_message := '项目不存在: ' || (record_data->>'project_name');
                v_errors := v_errors || jsonb_build_object('error', v_error_message);
                v_error_count := v_error_count + 1;
                CONTINUE;
            END IF;
            
            -- 2. 查找或创建司机
            SELECT id INTO v_driver_id 
            FROM public.drivers 
            WHERE name = (record_data->>'driver_name')::text 
            AND license_plate = (record_data->>'license_plate')::text;
            
            IF v_driver_id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    (record_data->>'driver_name')::text,
                    (record_data->>'license_plate')::text,
                    (record_data->>'driver_phone')::text,
                    auth.uid()
                )
                RETURNING id INTO v_driver_id;
                
                -- 关联司机到项目
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (v_driver_id, v_project_id, auth.uid())
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END IF;
            
            -- 3. 查找或创建地点
            INSERT INTO public.locations (name, user_id)
            VALUES ((record_data->>'loading_location')::text, auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            INSERT INTO public.locations (name, user_id)
            VALUES ((record_data->>'unloading_location')::text, auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            -- 关联地点到项目
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            SELECT l.id, v_project_id, auth.uid()
            FROM public.locations l
            WHERE l.name IN (
                (record_data->>'loading_location')::text,
                (record_data->>'unloading_location')::text
            )
            ON CONFLICT (location_id, project_id) DO NOTHING;
            
            -- 4. 查找链路
            IF record_data->>'chain_name' IS NOT NULL AND record_data->>'chain_name' != '' THEN
                SELECT id INTO v_chain_id 
                FROM public.partner_chains 
                WHERE chain_name = (record_data->>'chain_name')::text 
                AND project_id = v_project_id;
            END IF;
            
            -- 5. 使用统一的运单编号生成函数
            v_auto_number := public.generate_auto_number(v_loading_date_formatted);
            
            -- 6. 计算费用
            v_driver_payable := COALESCE((record_data->>'current_cost')::numeric, 0) + 
                              COALESCE((record_data->>'extra_cost')::numeric, 0);
            
            -- 7. 插入物流记录（现在 v_external_tracking_numbers 和 v_other_platform_names 是 text[] 类型，可以直接插入）
            INSERT INTO public.logistics_records (
                auto_number,
                project_id,
                project_name,
                chain_id,
                driver_id,
                driver_name,
                loading_location,
                unloading_location,
                loading_date,
                unloading_date,
                loading_weight,
                unloading_weight,
                current_cost,
                extra_cost,
                license_plate,
                driver_phone,
                transport_type,
                remarks,
                payable_cost,
                external_tracking_numbers,
                other_platform_names,
                created_by_user_id
            ) VALUES (
                v_auto_number,
                v_project_id,
                (record_data->>'project_name')::text,
                v_chain_id,
                v_driver_id,
                (record_data->>'driver_name')::text,
                (record_data->>'loading_location')::text,
                (record_data->>'unloading_location')::text,
                v_loading_date_formatted::date,
                v_unloading_date_formatted::date,
                NULLIF(record_data->>'loading_weight', '')::numeric,
                NULLIF(record_data->>'unloading_weight', '')::numeric,
                COALESCE((record_data->>'current_cost')::numeric, 0),
                COALESCE((record_data->>'extra_cost')::numeric, 0),
                (record_data->>'license_plate')::text,
                (record_data->>'driver_phone')::text,
                COALESCE(record_data->>'transport_type', '实际运输')::text,
                (record_data->>'remarks')::text,
                v_driver_payable,
                v_external_tracking_numbers,
                v_other_platform_names,
                auth.uid()
            )
            ON CONFLICT (auto_number) DO NOTHING
            RETURNING id INTO v_new_record_id;
            
            -- 如果插入成功
            IF v_new_record_id IS NOT NULL THEN
                v_success_count := v_success_count + 1;
            ELSE
                v_error_message := '运单编号冲突: ' || v_auto_number;
                v_errors := v_errors || jsonb_build_object('error', v_error_message);
                v_error_count := v_error_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            v_error_message := '记录处理失败: ' || SQLERRM;
            v_errors := v_errors || jsonb_build_object('error', v_error_message);
            v_error_count := v_error_count + 1;
        END;
    END LOOP;
    
    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'errors', v_errors
    );
END;
$$;

-- 为函数添加注释
COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS '批量导入运单记录，支持外部运单号和其他平台名称等可选字段（已修复数组字段类型转换）';

