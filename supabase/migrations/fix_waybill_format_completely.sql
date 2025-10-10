-- 彻底修复运单编号格式问题
-- 清理所有错误格式的运单编号，确保只生成标准格式

-- =====================================================
-- 第一步：清理所有错误格式的运单编号
-- =====================================================

-- 删除所有包含特殊字符前缀的运单编号
DELETE FROM public.logistics_records 
WHERE auto_number ~ '^[^Y].*YDN';

-- 删除所有格式不正确的运单编号
DELETE FROM public.logistics_records 
WHERE auto_number LIKE 'YDN%'
AND auto_number !~ '^YDN[0-9]{8}-[0-9]{3}$';

-- 删除包含双连字符的运单编号
DELETE FROM public.logistics_records 
WHERE auto_number LIKE 'YDN%-%-%';

-- 删除包含单数字序号的运单编号
DELETE FROM public.logistics_records 
WHERE auto_number ~ '^YDN[0-9]{8}-[0-9]-[0-9]$';

-- =====================================================
-- 第二步：创建完全干净的 generate_auto_number 函数
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
    final_number TEXT;
    max_attempts INTEGER := 1000;
    attempt_count INTEGER := 0;
    existing_count INTEGER;
BEGIN
    -- 验证输入日期格式
    IF loading_date_input IS NULL OR loading_date_input = '' THEN
        RAISE EXCEPTION '装货日期不能为空';
    END IF;
    
    -- 提取日期部分 (YYYYMMDD格式)
    BEGIN
        date_part := to_char(to_date(loading_date_input, 'YYYY-MM-DD'), 'YYYYMMDD');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '日期格式错误: %', loading_date_input;
    END;
    
    LOOP
        attempt_count := attempt_count + 1;
        
        -- 获取当天的下一个序号（只查询标准格式）
        SELECT COALESCE(MAX(CAST(substring(auto_number from 12) AS INTEGER)), 0) + 1
        INTO next_number
        FROM public.logistics_records
        WHERE auto_number LIKE 'YDN' || date_part || '-%'
        AND auto_number ~ '^YDN[0-9]{8}-[0-9]{3}$'  -- 严格匹配标准格式
        AND loading_date::date = loading_date_input::date;
        
        -- 补零到3位数（确保从001开始）
        padded_number := LPAD(next_number::TEXT, 3, '0');
        
        -- 生成完整编号：YDN + 日期 + - + 3位序号
        final_number := 'YDN' || date_part || '-' || padded_number;
        
        -- 检查编号是否已存在
        SELECT COUNT(*) INTO existing_count
        FROM public.logistics_records 
        WHERE auto_number = final_number;
        
        IF existing_count = 0 THEN
            RETURN final_number;
        END IF;
        
        -- 如果编号已存在，增加序号重试
        next_number := next_number + 1;
        
        -- 防止无限循环
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION '无法在 % 天内找到可用的运单编号，已尝试 % 次', 
                date_part, max_attempts;
        END IF;
    END LOOP;
END;
$function$;

-- =====================================================
-- 第三步：修复 batch_import_logistics_records 函数，确保数据清理
-- =====================================================

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
    v_external_tracking_numbers jsonb;
    v_other_platform_names jsonb;
    v_error_message text;
    v_cleaned_data jsonb;
BEGIN
    -- 逐条处理记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 清理数据，移除特殊字符
            v_cleaned_data := jsonb_build_object(
                'project_name', TRIM(REGEXP_REPLACE(record_data->>'project_name', '[^a-zA-Z0-9\u4e00-\u9fff]', '', 'g')),
                'driver_name', TRIM(REGEXP_REPLACE(record_data->>'driver_name', '[^a-zA-Z0-9\u4e00-\u9fff]', '', 'g')),
                'license_plate', TRIM(REGEXP_REPLACE(record_data->>'license_plate', '[^a-zA-Z0-9\u4e00-\u9fff]', '', 'g')),
                'driver_phone', TRIM(REGEXP_REPLACE(record_data->>'driver_phone', '[^0-9]', '', 'g')),
                'loading_location', TRIM(REGEXP_REPLACE(record_data->>'loading_location', '[^a-zA-Z0-9\u4e00-\u9fff]', '', 'g')),
                'unloading_location', TRIM(REGEXP_REPLACE(record_data->>'unloading_location', '[^a-zA-Z0-9\u4e00-\u9fff]', '', 'g')),
                'loading_date', record_data->>'loading_date',
                'unloading_date', record_data->>'unloading_date',
                'loading_weight', record_data->>'loading_weight',
                'unloading_weight', record_data->>'unloading_weight',
                'current_cost', record_data->>'current_cost',
                'extra_cost', record_data->>'extra_cost',
                'transport_type', record_data->>'transport_type',
                'remarks', record_data->>'remarks',
                'chain_name', record_data->>'chain_name',
                'external_tracking_numbers', record_data->>'external_tracking_numbers',
                'other_platform_names', record_data->>'other_platform_names'
            );
            
            -- 提取基本字段
            v_loading_date_formatted := (v_cleaned_data->>'loading_date')::text;
            v_unloading_date_formatted := COALESCE(NULLIF(v_cleaned_data->>'unloading_date', ''), v_cleaned_data->>'loading_date')::text;
            
            -- 处理外部跟踪号
            IF v_cleaned_data->>'external_tracking_numbers' IS NOT NULL AND v_cleaned_data->>'external_tracking_numbers' != '' THEN
                v_external_tracking_numbers := to_jsonb(string_to_array(v_cleaned_data->>'external_tracking_numbers', ','));
            ELSE
                v_external_tracking_numbers := '[]'::jsonb;
            END IF;
            
            -- 处理平台名称
            IF v_cleaned_data->>'other_platform_names' IS NOT NULL AND v_cleaned_data->>'other_platform_names' != '' THEN
                v_other_platform_names := to_jsonb(string_to_array(v_cleaned_data->>'other_platform_names', ','));
            ELSE
                v_other_platform_names := '[]'::jsonb;
            END IF;
            
            -- 1. 查找或创建项目
            SELECT id INTO v_project_id 
            FROM public.projects 
            WHERE name = (v_cleaned_data->>'project_name')::text;
            
            IF v_project_id IS NULL THEN
                v_error_message := '项目不存在: ' || (v_cleaned_data->>'project_name');
                v_errors := v_errors || jsonb_build_object('error', v_error_message);
                v_error_count := v_error_count + 1;
                CONTINUE;
            END IF;
            
            -- 2. 查找或创建司机
            SELECT id INTO v_driver_id 
            FROM public.drivers 
            WHERE name = (v_cleaned_data->>'driver_name')::text 
            AND license_plate = (v_cleaned_data->>'license_plate')::text;
            
            IF v_driver_id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    (v_cleaned_data->>'driver_name')::text,
                    (v_cleaned_data->>'license_plate')::text,
                    (v_cleaned_data->>'driver_phone')::text,
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
            VALUES ((v_cleaned_data->>'loading_location')::text, auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            INSERT INTO public.locations (name, user_id)
            VALUES ((v_cleaned_data->>'unloading_location')::text, auth.uid())
            ON CONFLICT (name) DO NOTHING;
            
            -- 关联地点到项目
            INSERT INTO public.location_projects (location_id, project_id, user_id)
            SELECT l.id, v_project_id, auth.uid()
            FROM public.locations l
            WHERE l.name IN (
                (v_cleaned_data->>'loading_location')::text,
                (v_cleaned_data->>'unloading_location')::text
            )
            ON CONFLICT (location_id, project_id) DO NOTHING;
            
            -- 4. 查找链路
            IF v_cleaned_data->>'chain_name' IS NOT NULL AND v_cleaned_data->>'chain_name' != '' THEN
                SELECT id INTO v_chain_id 
                FROM public.partner_chains 
                WHERE chain_name = (v_cleaned_data->>'chain_name')::text 
                AND project_id = v_project_id;
            END IF;
            
            -- 5. 使用统一的运单编号生成函数
            v_auto_number := public.generate_auto_number(v_loading_date_formatted);
            
            -- 6. 计算费用
            v_driver_payable := COALESCE((v_cleaned_data->>'current_cost')::numeric, 0) + 
                              COALESCE((v_cleaned_data->>'extra_cost')::numeric, 0);
            
            -- 7. 插入物流记录
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
                (v_cleaned_data->>'project_name')::text,
                v_chain_id,
                v_driver_id,
                (v_cleaned_data->>'driver_name')::text,
                (v_cleaned_data->>'loading_location')::text,
                (v_cleaned_data->>'unloading_location')::text,
                v_loading_date_formatted::date,
                v_unloading_date_formatted::date,
                NULLIF(v_cleaned_data->>'loading_weight', '')::numeric,
                NULLIF(v_cleaned_data->>'unloading_weight', '')::numeric,
                COALESCE((v_cleaned_data->>'current_cost')::numeric, 0),
                COALESCE((v_cleaned_data->>'extra_cost')::numeric, 0),
                (v_cleaned_data->>'license_plate')::text,
                (v_cleaned_data->>'driver_phone')::text,
                COALESCE(v_cleaned_data->>'transport_type', '实际运输')::text,
                (v_cleaned_data->>'remarks')::text,
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

-- =====================================================
-- 第四步：验证修复结果
-- =====================================================

-- 检查清理后的运单编号格式
SELECT 
    auto_number,
    loading_date,
    CASE 
        WHEN auto_number ~ '^YDN[0-9]{8}-[0-9]{3}$' THEN '标准格式'
        ELSE '格式错误'
    END as format_status
FROM public.logistics_records 
WHERE auto_number LIKE 'YDN%'
ORDER BY created_at DESC
LIMIT 10;

-- 验证修复完成
SELECT '运单编号格式已彻底修复！' as status;
