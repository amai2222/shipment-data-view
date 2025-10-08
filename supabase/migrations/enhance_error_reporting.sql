-- 增强导入错误报告系统
-- 提供更详细的错误信息，包括具体的Excel行号、字段名和单元格值

-- =====================================================
-- 第一步：创建增强的错误报告函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.analyze_field_errors(record_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    field_errors jsonb := '{}';
    field_value text;
    field_name text;
    numeric_fields text[] := ARRAY['loading_weight', 'unloading_weight', 'current_cost', 'extra_cost'];
BEGIN
    -- 检查数字字段
    FOREACH field_name IN ARRAY numeric_fields
    LOOP
        field_value := record_data->>field_name;
        
        IF field_value IS NOT NULL AND TRIM(field_value) != '' THEN
            field_errors := field_errors || jsonb_build_object(
                field_name, jsonb_build_object(
                    'value', field_value,
                    'is_valid', CASE 
                        WHEN public.safe_numeric_conversion(field_value, NULL) IS NOT NULL 
                        THEN true 
                        ELSE false 
                    END,
                    'converted_value', public.safe_numeric_conversion(field_value, NULL)
                )
            );
        END IF;
    END LOOP;
    
    RETURN field_errors;
END;
$$;

-- =====================================================
-- 第二步：增强 import_logistics_data 函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.import_logistics_data(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    record_data jsonb;
    row_index integer := 0;
    success_count integer := 0;
    failures jsonb := '[]';
    new_record_ids uuid[] := '{}';
    
    -- 项目相关变量
    project_record record;
    project_id_val uuid;
    
    -- 司机相关变量
    driver_result record;
    driver_id_val uuid;
    
    -- 链路相关变量
    chain_id_val uuid;
    effective_billing_type_id integer;
    
    -- 日期相关变量
    loading_date_formatted timestamp;
    unloading_date_formatted timestamp;
    
    -- 运单编号
    v_auto_number text;
    
    -- 费用计算
    driver_payable numeric;
    
    -- 新记录ID
    new_record_id uuid;
    
    -- 字段错误分析
    field_errors jsonb;
BEGIN
    -- 遍历每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        row_index := row_index + 1;
        
        BEGIN
            -- 第1步：获取或创建项目
            SELECT id, name INTO project_record
            FROM public.projects 
            WHERE name = TRIM(record_data->>'project_name')
            LIMIT 1;
            
            IF project_record.id IS NULL THEN
                INSERT INTO public.projects (name, created_by_user_id, user_id)
                VALUES (TRIM(record_data->>'project_name'), auth.uid(), auth.uid())
                RETURNING id, name INTO project_record;
            END IF;
            
            project_id_val := project_record.id;

            -- 第2步：获取或创建司机
            SELECT id, name INTO driver_result
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name')
            LIMIT 1;
            
            IF driver_result.id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, created_by_user_id, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid(),
                    auth.uid()
                )
                RETURNING id, name INTO driver_result;
            END IF;
            
            driver_id_val := driver_result.id;

            -- 第3步：处理合作链路
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val
                FROM public.chains 
                WHERE name = TRIM(record_data->>'chain_name')
                LIMIT 1;
                
                IF chain_id_val IS NULL THEN
                    INSERT INTO public.chains (name, created_by_user_id, user_id)
                    VALUES (TRIM(record_data->>'chain_name'), auth.uid(), auth.uid())
                    RETURNING id INTO chain_id_val;
                END IF;
                
                -- 获取计费类型
                SELECT billing_type_id INTO effective_billing_type_id
                FROM public.chain_billing_types 
                WHERE chain_id = chain_id_val
                LIMIT 1;
                
                -- 如果没有找到链路，使用默认值1
                IF chain_id_val IS NULL THEN
                    effective_billing_type_id := 1;
                END IF;
            END IF;

            -- 第4步：准备日期数据
            loading_date_formatted := (record_data->>'loading_date')::timestamp;
            unloading_date_formatted := COALESCE(
                NULLIF(record_data->>'unloading_date', ''),
                record_data->>'loading_date'
            )::timestamp;
            
            -- 第5步：生成运单编号
            v_auto_number := public.generate_auto_number(record_data->>'loading_date');
            
            -- 第6步：使用安全转换函数计算应付费用
            driver_payable := public.safe_numeric_conversion(record_data->>'current_cost', 0) + 
                             public.safe_numeric_conversion(record_data->>'extra_cost', 0);

            -- 第7步：插入运单记录（使用安全转换函数）
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
                -- 使用安全转换函数处理数字字段
                CASE WHEN record_data->>'loading_weight' IS NOT NULL AND TRIM(record_data->>'loading_weight') != '' 
                     THEN public.safe_numeric_conversion(record_data->>'loading_weight', NULL) ELSE NULL END,
                CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                     THEN public.safe_numeric_conversion(record_data->>'unloading_weight', NULL) ELSE NULL END,
                public.safe_numeric_conversion(record_data->>'current_cost', 0),
                public.safe_numeric_conversion(record_data->>'extra_cost', 0),
                TRIM(record_data->>'license_plate'),
                TRIM(record_data->>'driver_phone'),
                COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                record_data->>'remarks',
                driver_payable,
                auth.uid(),
                auth.uid(),
                CASE WHEN record_data->>'external_tracking_numbers' IS NOT NULL 
                     THEN (record_data->>'external_tracking_numbers')::text[] 
                     ELSE NULL END,
                CASE WHEN record_data->>'other_platform_names' IS NOT NULL 
                     THEN (record_data->>'other_platform_names')::text[] 
                     ELSE NULL END
            )
            RETURNING id INTO new_record_id;
            
            new_record_ids := array_append(new_record_ids, new_record_id);
            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            -- 分析字段错误
            field_errors := public.analyze_field_errors(record_data);
            
            -- 构建增强的错误信息
            failures := failures || jsonb_build_object(
                'row_index', row_index,
                'excel_row', row_index + 1,  -- Excel行号（从1开始）
                'data', record_data,
                'error', SQLERRM,
                'field_errors', field_errors,
                'project_name', record_data->>'project_name',
                'driver_name', record_data->>'driver_name',
                'license_plate', record_data->>'license_plate'
            );
        END;
    END LOOP;

    -- 第8步：批量计算合作方成本（性能优化）
    IF array_length(new_record_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(new_record_ids);
    END IF;

    -- 返回增强的导入结果
    RETURN jsonb_build_object(
        'success_count', success_count,
        'failures', failures,
        'new_record_ids', new_record_ids,
        'total_processed', row_index
    );
END;
$function$;

-- =====================================================
-- 第三步：创建字段错误分析函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_field_error_summary(field_errors jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    error_summary text := '';
    field_name text;
    field_info jsonb;
    invalid_fields text[] := '{}';
BEGIN
    -- 收集所有无效字段
    FOR field_name IN SELECT jsonb_object_keys(field_errors)
    LOOP
        field_info := field_errors->field_name;
        
        IF field_info->>'is_valid' = 'false' THEN
            invalid_fields := array_append(invalid_fields, 
                field_name || ': "' || (field_info->>'value') || '"'
            );
        END IF;
    END LOOP;
    
    -- 构建错误摘要
    IF array_length(invalid_fields, 1) > 0 THEN
        error_summary := '字段错误: ' || array_to_string(invalid_fields, ', ');
    END IF;
    
    RETURN error_summary;
END;
$$;

-- =====================================================
-- 第四步：测试增强的错误报告
-- =====================================================

-- 测试数据
DO $$
DECLARE
    test_data jsonb;
    result jsonb;
    failure jsonb;
    field_errors jsonb;
BEGIN
    -- 创建测试数据（包含各种错误格式）
    test_data := '[
        {
            "project_name": "测试项目",
            "driver_name": "测试司机1",
            "license_plate": "测试001",
            "driver_phone": "13800138001",
            "loading_location": "装货地",
            "unloading_location": "卸货地",
            "loading_date": "2024-01-01",
            "loading_weight": "--24",
            "current_cost": "--24",
            "extra_cost": "0",
            "transport_type": "实际运输"
        },
        {
            "project_name": "测试项目",
            "driver_name": "测试司机2",
            "license_plate": "测试002",
            "driver_phone": "13800138002",
            "loading_location": "装货地",
            "unloading_location": "卸货地",
            "loading_date": "2024-01-01",
            "loading_weight": "-0-3",
            "current_cost": "-0-3",
            "extra_cost": "0",
            "transport_type": "实际运输"
        }
    ]'::jsonb;
    
    -- 执行导入
    result := public.import_logistics_data(test_data);
    
    -- 显示结果
    RAISE NOTICE '导入结果: %', result;
    
    -- 显示失败详情
    IF (result->'failures')::jsonb != '[]'::jsonb THEN
        RAISE NOTICE '失败记录详情:';
        
        FOR failure IN SELECT * FROM jsonb_array_elements(result->'failures')
        LOOP
            RAISE NOTICE 'Excel第 % 行: %', 
                failure->>'excel_row',
                failure->>'error';
            RAISE NOTICE '  项目: %, 司机: %, 车牌: %', 
                failure->>'project_name',
                failure->>'driver_name',
                failure->>'license_plate';
                
            -- 显示字段错误
            field_errors := failure->'field_errors';
            IF field_errors IS NOT NULL THEN
                RAISE NOTICE '  字段错误: %', public.get_field_error_summary(field_errors);
            END IF;
        END LOOP;
    END IF;
END $$;

COMMENT ON FUNCTION public.import_logistics_data(jsonb) IS '增强版批量导入运单数据，提供详细的错误报告包括Excel行号、字段名和单元格值';
COMMENT ON FUNCTION public.analyze_field_errors(jsonb) IS '分析记录中的字段错误，返回详细的字段验证信息';
COMMENT ON FUNCTION public.get_field_error_summary(jsonb) IS '生成字段错误的摘要信息';
