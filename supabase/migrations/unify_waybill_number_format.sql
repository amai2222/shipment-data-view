-- 统一运单编号格式：YDN + YYYYMMDD + - + 3位序号
-- 应用于所有导入功能（数据维护、运单管理）

-- =====================================================
-- 第一步：修改 generate_auto_number 函数
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
BEGIN
    -- 提取日期部分 (YYYYMMDD格式)
    date_part := to_char(to_date(loading_date_input, 'YYYY-MM-DD'), 'YYYYMMDD');
    
    -- 获取当天的下一个序号（查询YDN开头的编号）
    -- 新格式：YDN20250108-001，序号从第12位开始，共3位
    SELECT COALESCE(MAX(CAST(substring(auto_number from 12) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.logistics_records
    WHERE auto_number LIKE 'YDN' || date_part || '-%';
    
    -- 补零到3位数
    padded_number := LPAD(next_number::TEXT, 3, '0');
    
    -- 返回新格式：YDN + 日期 + - + 序号
    RETURN 'YDN' || date_part || '-' || padded_number;
END;
$function$;

COMMENT ON FUNCTION public.generate_auto_number(text) IS '生成统一格式的运单编号：YDN + YYYYMMDD + - + 3位序号，例如：YDN20250108-001';

-- =====================================================
-- 第二步：修改 import_logistics_data 函数
-- 统一使用 generate_auto_number 函数
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
            
            -- 第9步：计算应付费用
            driver_payable := COALESCE((record_data->>'current_cost')::numeric, 0) + 
                             COALESCE((record_data->>'extra_cost')::numeric, 0);

            -- 第10步：插入运单记录（包含平台字段）
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
                CASE WHEN record_data->>'loading_weight' IS NOT NULL AND TRIM(record_data->>'loading_weight') != '' 
                     THEN (record_data->>'loading_weight')::numeric ELSE NULL END,
                CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                     THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                     THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                     THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
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

COMMENT ON FUNCTION public.import_logistics_data(jsonb) IS '批量导入运单数据，统一使用 generate_auto_number 生成运单编号';

-- =====================================================
-- 第三步：确保批量成本计算函数存在（性能优化）
-- =====================================================

CREATE OR REPLACE FUNCTION public.recalculate_and_update_costs_for_records(p_record_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 删除现有的成本记录
    DELETE FROM public.logistics_partner_costs 
    WHERE logistics_record_id = ANY(p_record_ids);

    -- 批量插入新的成本记录
    WITH records_to_process AS (
        SELECT
            lr.id,
            lr.project_id,
            -- 确定有效链路ID
            COALESCE(lr.chain_id, dc.id) AS effective_chain_id,
            -- 计算基础应付金额
            (COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0)) AS base_payable_amount,
            -- 计算有效重量
            COALESCE(
                NULLIF(LEAST(COALESCE(lr.loading_weight, 999999), COALESCE(lr.unloading_weight, 999999)), 999999),
                COALESCE(lr.loading_weight, lr.unloading_weight, 0)
            ) AS effective_weight
        FROM
            public.logistics_records lr
        LEFT JOIN -- 查找默认链路
            public.partner_chains dc ON lr.project_id = dc.project_id AND dc.is_default = true
        WHERE
            lr.id = ANY(p_record_ids)
    )
    INSERT INTO public.logistics_partner_costs
        (logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, user_id)
    SELECT
        rec.id AS logistics_record_id,
        pp.partner_id,
        pp.level,
        rec.base_payable_amount AS base_amount,
        -- 应用公式计算最终金额
        CASE
            WHEN pp.calculation_method = 'profit' THEN
                CASE
                    WHEN rec.effective_weight > 0 THEN
                        rec.base_payable_amount + (COALESCE(pp.profit_rate, 0) * rec.effective_weight)
                    ELSE
                        rec.base_payable_amount + COALESCE(pp.profit_rate, 0)
                END
            ELSE -- 默认为税点法
                CASE
                    WHEN pp.tax_rate IS NOT NULL AND pp.tax_rate <> 1 THEN
                        rec.base_payable_amount / (1 - pp.tax_rate)
                    ELSE
                        rec.base_payable_amount
                END
        END AS payable_amount,
        pp.tax_rate,
        auth.uid()
    FROM
        records_to_process rec
    -- 将每条运单与其有效链路上的所有合作方进行连接
    JOIN
        public.project_partners pp ON rec.effective_chain_id = pp.chain_id
    WHERE
        rec.effective_chain_id IS NOT NULL AND rec.base_payable_amount > 0;
END;
$$;

COMMENT ON FUNCTION public.recalculate_and_update_costs_for_records(uuid[]) IS '批量重新计算和更新运单的合作方成本，用于提高导入性能';

-- =====================================================
-- 第四步（可选）：迁移现有的旧格式运单编号
-- 如果需要将现有的旧格式编号转换为新格式，取消注释以下代码
-- =====================================================

/*
-- 备份现有的运单编号到新列
ALTER TABLE public.logistics_records ADD COLUMN IF NOT EXISTS old_auto_number TEXT;

-- 更新旧编号：将纯数字格式转换为新格式
UPDATE public.logistics_records
SET 
    old_auto_number = auto_number,
    auto_number = 'YDN' || 
                  SUBSTRING(auto_number, 1, 8) || 
                  '-' || 
                  SUBSTRING(auto_number, 9, 3)
WHERE auto_number ~ '^\d{11,12}$'  -- 只转换纯数字格式的编号
  AND auto_number NOT LIKE 'YDN%'; -- 排除已经是新格式的编号

-- 添加注释
COMMENT ON COLUMN public.logistics_records.old_auto_number IS '旧的运单编号格式（迁移前备份）';
*/

-- =====================================================
-- 验证和测试
-- =====================================================

-- 测试 generate_auto_number 函数
DO $$
DECLARE
    test_number TEXT;
BEGIN
    test_number := public.generate_auto_number('2025-01-08');
    RAISE NOTICE '测试生成运单编号: %', test_number;
    
    IF test_number LIKE 'YDN20250108-%' THEN
        RAISE NOTICE '✓ 运单编号格式正确';
    ELSE
        RAISE WARNING '✗ 运单编号格式不正确: %', test_number;
    END IF;
END $$;
