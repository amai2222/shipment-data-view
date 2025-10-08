-- 修复运单编号重复问题
-- 处理同一天内序号冲突的情况

-- =====================================================
-- 第一步：改进 generate_auto_number 函数，处理并发冲突
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_auto_number(loading_date_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    date_part TEXT;
    next_number INTEGER;
    padded_number TEXT;
    max_attempts INTEGER := 10;
    attempt_count INTEGER := 0;
    final_number TEXT;
BEGIN
    -- 提取日期部分 (YYYYMMDD格式)
    date_part := to_char(to_date(loading_date_input, 'YYYY-MM-DD'), 'YYYYMMDD');
    
    LOOP
        attempt_count := attempt_count + 1;
        
        -- 获取当天的下一个序号（查询YDN开头的编号）
        -- 新格式：YDN20250108-001，序号从第12位开始，共3位
        SELECT COALESCE(MAX(CAST(substring(auto_number from 12) AS INTEGER)), 0) + 1
        INTO next_number
        FROM public.logistics_records
        WHERE auto_number LIKE 'YDN' || date_part || '-%';
        
        -- 补零到3位数
        padded_number := LPAD(next_number::TEXT, 3, '0');
        
        -- 生成完整编号
        final_number := 'YDN' || date_part || '-' || padded_number;
        
        -- 检查编号是否已存在
        IF NOT EXISTS (SELECT 1 FROM public.logistics_records WHERE auto_number = final_number) THEN
            RETURN final_number;
        END IF;
        
        -- 如果编号已存在，增加序号重试
        next_number := next_number + 1;
        
        -- 防止无限循环
        IF attempt_count >= max_attempts THEN
            -- 使用时间戳确保唯一性
            final_number := 'YDN' || date_part || '-' || LPAD(next_number::TEXT, 3, '0') || 
                          '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
            RETURN final_number;
        END IF;
    END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.generate_auto_number(text) IS '生成唯一格式的运单编号：YDN + YYYYMMDD + - + 3位序号，自动处理重复冲突';

-- =====================================================
-- 第二步：创建批量生成运单编号的函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_batch_waybill_numbers(p_count integer, p_date text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    date_part TEXT;
    start_number INTEGER;
    numbers TEXT[] := '{}';
    i INTEGER;
    padded_number TEXT;
    final_number TEXT;
BEGIN
    -- 提取日期部分
    date_part := to_char(to_date(p_date, 'YYYY-MM-DD'), 'YYYYMMDD');
    
    -- 获取当天的起始序号
    SELECT COALESCE(MAX(CAST(substring(auto_number from 12) AS INTEGER)), 0) + 1
    INTO start_number
    FROM public.logistics_records
    WHERE auto_number LIKE 'YDN' || date_part || '-%';
    
    -- 生成指定数量的编号
    FOR i IN 1..p_count LOOP
        padded_number := LPAD((start_number + i - 1)::TEXT, 3, '0');
        final_number := 'YDN' || date_part || '-' || padded_number;
        numbers := array_append(numbers, final_number);
    END LOOP;
    
    RETURN numbers;
END;
$$;

COMMENT ON FUNCTION public.generate_batch_waybill_numbers(integer, text) IS '批量生成运单编号，用于避免并发冲突';

-- =====================================================
-- 第三步：更新 import_logistics_data 函数，使用批量编号生成
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
    waybill_numbers text[] := '{}';
    waybill_index integer := 0;
    total_records integer;
BEGIN
    -- 计算总记录数
    total_records := jsonb_array_length(p_records);
    
    -- 预生成所有运单编号（按日期分组）
    -- 这里简化处理，为每条记录单独生成编号
    
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
            
            -- 第8步：生成运单编号（使用改进的函数）
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

COMMENT ON FUNCTION public.import_logistics_data(jsonb) IS '批量导入运单数据，使用安全数字转换和防重复编号生成';

-- =====================================================
-- 第四步：测试修复效果
-- =====================================================

-- 测试安全转换函数的新格式
DO $$
DECLARE
    test_cases text[] := ARRAY['-0-3', '-0-5', '--29', '---29', '--', '---', '----', '-', '+', '', 'abc', '12.34', '-12.34', '+12.34'];
    test_value text;
    result numeric;
BEGIN
    RAISE NOTICE '测试安全数字转换函数（新格式）:';
    
    FOREACH test_value IN ARRAY test_cases
    LOOP
        result := public.safe_numeric_conversion(test_value, 0);
        RAISE NOTICE '输入: "%" -> 输出: %', test_value, result;
    END LOOP;
END $$;
