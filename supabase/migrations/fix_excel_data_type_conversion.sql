-- 修复Excel导入数据类型转换问题
-- 处理 "--29" 这样的无效数字字符串

-- =====================================================
-- 第一步：创建安全的数字转换函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.safe_numeric_conversion(input_text text, default_value numeric DEFAULT 0)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- 如果输入为空或null，返回默认值
    IF input_text IS NULL OR TRIM(input_text) = '' THEN
        RETURN default_value;
    END IF;
    
    -- 清理字符串：移除前后空格
    input_text := TRIM(input_text);
    
    -- 处理特殊情况
    CASE input_text
        WHEN '--', '---', '----', '-----' THEN
            RETURN default_value;
        WHEN '-', '--', '---', '----', '-----' THEN
            RETURN default_value;
        ELSE
            -- 尝试提取数字部分
            -- 匹配模式：可选的正负号 + 数字 + 可选的小数点 + 数字
            IF input_text ~ '^[+-]?[0-9]+(\.[0-9]+)?$' THEN
                BEGIN
                    RETURN input_text::numeric;
                EXCEPTION WHEN OTHERS THEN
                    RETURN default_value;
                END;
            ELSE
                -- 尝试提取数字部分（移除非数字字符）
                DECLARE
                    cleaned_text text;
                BEGIN
                    -- 处理特殊格式如 "-0-3" -> "-3", "-0-5" -> "-5"
                    -- 先处理连续的数字和符号
                    cleaned_text := input_text;
                    
                    -- 处理 "-0-3" 格式：提取最后一个数字部分
                    IF cleaned_text ~ '^-0-[0-9]+$' THEN
                        cleaned_text := '-' || regexp_replace(cleaned_text, '^-0-', '');
                    END IF;
                    
                    -- 处理其他连续符号的情况
                    cleaned_text := regexp_replace(cleaned_text, '^[+-]+', 
                        CASE 
                            WHEN length(regexp_replace(cleaned_text, '[^+-]', '', 'g')) % 2 = 0 THEN '+'
                            ELSE '-'
                        END
                    );
                    
                    -- 提取数字、小数点、正负号
                    cleaned_text := regexp_replace(cleaned_text, '[^0-9+-.]', '', 'g');
                    
                    -- 如果清理后为空，返回默认值
                    IF cleaned_text = '' OR cleaned_text = '+' OR cleaned_text = '-' THEN
                        RETURN default_value;
                    END IF;
                    
                    -- 验证清理后的文本是否为有效数字
                    IF cleaned_text ~ '^[+-]?[0-9]+(\.[0-9]+)?$' THEN
                        RETURN cleaned_text::numeric;
                    ELSE
                        RETURN default_value;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    RETURN default_value;
                END;
            END IF;
    END CASE;
END;
$$;

COMMENT ON FUNCTION public.safe_numeric_conversion(text, numeric) IS '安全地将文本转换为数字，处理Excel中的无效数字格式如"--29"';

-- =====================================================
-- 第二步：更新 import_logistics_data 函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.import_logistics_data(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
            -- 第1步：验证必填字段
            IF (record_data->>'project_name') IS NULL OR (record_data->>'project_name') = '' OR
               (record_data->>'driver_name') IS NULL OR (record_data->>'driver_name') = '' OR
               (record_data->>'loading_location') IS NULL OR (record_data->>'loading_location') = '' OR
               (record_data->>'unloading_location') IS NULL OR (record_data->>'unloading_location') = '' OR
               (record_data->>'loading_date') IS NULL OR (record_data->>'loading_date') = '' THEN
                failures := failures || jsonb_build_object(
                    'row_index', row_index,
                    'data', record_data,
                    'error', '缺少必填字段'
                );
                CONTINUE;
            END IF;

            -- 第2步：查找项目
            SELECT id, name INTO project_record
            FROM public.projects 
            WHERE name = (record_data->>'project_name')
            LIMIT 1;

            IF project_record.id IS NULL THEN
                failures := failures || jsonb_build_object(
                    'row_index', row_index,
                    'data', record_data,
                    'error', '未找到匹配的项目: ' || (record_data->>'project_name')
                );
                CONTINUE;
            END IF;

            -- 第3步：获取或创建司机
            SELECT * INTO driver_result
            FROM public.get_or_create_driver(
                (record_data->>'driver_name'), 
                (record_data->>'license_plate'), 
                (record_data->>'driver_phone')
            );
            
            -- 关联司机与项目
            INSERT INTO public.driver_projects (driver_id, project_id, user_id)
            VALUES (driver_result.id, project_record.id, auth.uid())
            ON CONFLICT (driver_id, project_id) DO NOTHING;

            -- 第4步：查找或创建装货地点
            SELECT id INTO loading_location_id
            FROM public.locations
            WHERE name = (record_data->>'loading_location')
            LIMIT 1;
            
            IF loading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES ((record_data->>'loading_location'), auth.uid())
                RETURNING id INTO loading_location_id;
                
                -- 关联地点与项目
                INSERT INTO public.location_projects (location_id, project_id, user_id)
                VALUES (loading_location_id, project_record.id, auth.uid())
                ON CONFLICT (location_id, project_id) DO NOTHING;
            END IF;
            
            -- 第5步：查找或创建卸货地点
            SELECT id INTO unloading_location_id
            FROM public.locations
            WHERE name = (record_data->>'unloading_location')
            LIMIT 1;
            
            IF unloading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES ((record_data->>'unloading_location'), auth.uid())
                RETURNING id INTO unloading_location_id;
                
                -- 关联地点与项目
                INSERT INTO public.location_projects (location_id, project_id, user_id)
                VALUES (unloading_location_id, project_record.id, auth.uid())
                ON CONFLICT (location_id, project_id) DO NOTHING;
            END IF;

            -- 第6步：查找合作链路
            chain_id_val := NULL;
            effective_billing_type_id := 1;  -- 默认值
            
            IF (record_data->>'chain_name') IS NOT NULL AND (record_data->>'chain_name') != '' THEN
                SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                FROM public.partner_chains 
                WHERE project_id = project_record.id 
                  AND chain_name = (record_data->>'chain_name') 
                LIMIT 1;
                
                -- 如果没有找到链路，使用默认值1
                IF chain_id_val IS NULL THEN
                    effective_billing_type_id := 1;
                END IF;
            END IF;

            -- 第7步：准备日期数据
            loading_date_formatted := (record_data->>'loading_date')::timestamp;
            unloading_date_formatted := COALESCE(
                NULLIF(record_data->>'unloading_date', ''),
                record_data->>'loading_date'
            )::timestamp;
            
            -- 第8步：统一使用 generate_auto_number 函数生成运单编号
            v_auto_number := public.generate_auto_number(record_data->>'loading_date');
            
            -- 第9步：使用安全转换函数计算应付费用
            driver_payable := public.safe_numeric_conversion(record_data->>'current_cost', 0) + 
                             public.safe_numeric_conversion(record_data->>'extra_cost', 0);

            -- 第10步：插入运单记录（使用安全转换函数）
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
            failures := failures || jsonb_build_object(
                'row_index', row_index,
                'data', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 第11步：批量计算合作方成本（性能优化）
    IF array_length(new_record_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(new_record_ids);
    END IF;

    -- 返回导入结果
    RETURN jsonb_build_object(
        'success_count', success_count,
        'failures', failures,
        'new_record_ids', new_record_ids
    );
END;
$function$;

COMMENT ON FUNCTION public.import_logistics_data(jsonb) IS '批量导入运单数据，使用安全数字转换处理Excel数据格式问题';

-- =====================================================
-- 第三步：测试安全转换函数
-- =====================================================

-- 测试各种无效数字格式
DO $$
DECLARE
    test_cases text[] := ARRAY['--29', '---29', '----29', '--', '---', '----', '-', '+', '', 'abc', '12.34', '-12.34', '+12.34'];
    test_value text;
    result numeric;
BEGIN
    RAISE NOTICE '测试安全数字转换函数:';
    
    FOREACH test_value IN ARRAY test_cases
    LOOP
        result := public.safe_numeric_conversion(test_value, 0);
        RAISE NOTICE '输入: "%" -> 输出: %', test_value, result;
    END LOOP;
END $$;
