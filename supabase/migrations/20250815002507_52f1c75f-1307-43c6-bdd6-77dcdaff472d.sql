-- 创建智能导入函数，实现完整的导入逻辑
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
                
                -- 关联地点与项目
                INSERT INTO public.location_projects (location_id, project_id, user_id)
                VALUES (loading_location_id, project_record.id, auth.uid())
                ON CONFLICT (location_id, project_id) DO NOTHING;
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
                
                -- 关联地点与项目
                INSERT INTO public.location_projects (location_id, project_id, user_id)
                VALUES (unloading_location_id, project_record.id, auth.uid())
                ON CONFLICT (location_id, project_id) DO NOTHING;
            END IF;

            -- 第5步：查找合作链路
            chain_id_val := NULL;
            effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
            
            IF (record_data->>'chain_name') IS NOT NULL AND (record_data->>'chain_name') != '' THEN
                SELECT id, billing_type_id INTO chain_id_val, effective_billing_type_id
                FROM public.partner_chains 
                WHERE project_id = project_record.id 
                  AND chain_name = (record_data->>'chain_name') 
                LIMIT 1;
                
                -- 如果没有找到链路，使用项目的默认billing_type_id
                IF chain_id_val IS NULL THEN
                    effective_billing_type_id := COALESCE(project_record.billing_type_id, 1);
                END IF;
            END IF;

            -- 第6步：准备日期数据
            loading_date_formatted := (record_data->>'loading_date')::timestamp;
            unloading_date_formatted := COALESCE(
                NULLIF(record_data->>'unloading_date', ''),
                record_data->>'loading_date'
            )::timestamp;
            
            -- 第7步：生成运单编号
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
            
            -- 第8步：计算应付费用
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

-- 创建批量成本计算函数
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