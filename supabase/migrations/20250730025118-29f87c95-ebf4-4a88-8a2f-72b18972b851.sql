-- 创建批量导入运单数据的RPC函数
-- 用于替代逐行调用，提高导入性能

CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(
    p_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    record_data jsonb;
    success_count integer := 0;
    error_count integer := 0;
    errors jsonb := '[]'::jsonb;
    result_record jsonb;
    project_record record;
    driver_result record;
    chain_id uuid;
    loading_date_formatted text;
    unloading_date_formatted text;
    new_record_id uuid;
    v_auto_number text;
    driver_payable numeric;
BEGIN
    -- 遍历每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 验证必填字段
            IF (record_data->>'project_name') IS NULL OR (record_data->>'project_name') = '' OR
               (record_data->>'driver_name') IS NULL OR (record_data->>'driver_name') = '' OR
               (record_data->>'loading_location') IS NULL OR (record_data->>'loading_location') = '' OR
               (record_data->>'unloading_location') IS NULL OR (record_data->>'unloading_location') = '' OR
               (record_data->>'loading_date') IS NULL OR (record_data->>'loading_date') = '' THEN
                errors := errors || jsonb_build_object('error', '缺少必填字段');
                error_count := error_count + 1;
                CONTINUE;
            END IF;

            -- 查找项目
            SELECT id, name INTO project_record
            FROM public.projects 
            WHERE name = (record_data->>'project_name')
            LIMIT 1;

            IF project_record.id IS NULL THEN
                errors := errors || jsonb_build_object('error', '未找到匹配的项目: ' || (record_data->>'project_name'));
                error_count := error_count + 1;
                CONTINUE;
            END IF;

            -- 获取或创建司机
            SELECT driver_id, driver_name INTO driver_result
            FROM public.get_or_create_driver(
                (record_data->>'driver_name'),
                (record_data->>'license_plate'),
                (record_data->>'driver_phone'),
                project_record.id
            )
            LIMIT 1;

            IF driver_result.driver_id IS NULL THEN
                errors := errors || jsonb_build_object('error', '处理司机信息失败: ' || (record_data->>'driver_name'));
                error_count := error_count + 1;
                CONTINUE;
            END IF;

            -- 创建或关联地点
            PERFORM public.get_or_create_location((record_data->>'loading_location'), project_record.id);
            PERFORM public.get_or_create_location((record_data->>'unloading_location'), project_record.id);

            -- 查找合作链路
            chain_id := NULL;
            IF (record_data->>'chain_name') IS NOT NULL AND (record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id
                FROM public.partner_chains
                WHERE project_id = project_record.id AND chain_name = (record_data->>'chain_name')
                LIMIT 1;
            END IF;

            -- 格式化日期
            loading_date_formatted := (record_data->>'loading_date');
            unloading_date_formatted := COALESCE((record_data->>'unloading_date'), loading_date_formatted);

            -- 生成运单编号
            v_auto_number := public.generate_auto_number(loading_date_formatted);

            -- 计算应付金额
            driver_payable := COALESCE((record_data->>'current_cost')::numeric, 0) + COALESCE((record_data->>'extra_cost')::numeric, 0);

            -- 插入运单记录
            INSERT INTO public.logistics_records (
                auto_number, project_id, project_name, chain_id, driver_id, driver_name,
                loading_location, unloading_location, loading_date, unloading_date,
                loading_weight, unloading_weight, current_cost, extra_cost,
                license_plate, driver_phone, transport_type, remarks,
                payable_cost, created_by_user_id
            ) VALUES (
                v_auto_number, project_record.id, project_record.name, chain_id, driver_result.driver_id, driver_result.driver_name,
                (record_data->>'loading_location'), (record_data->>'unloading_location'),
                loading_date_formatted, unloading_date_formatted,
                NULLIF((record_data->>'loading_weight')::text, '')::numeric,
                NULLIF((record_data->>'unloading_weight')::text, '')::numeric,
                COALESCE((record_data->>'current_cost')::numeric, 0),
                COALESCE((record_data->>'extra_cost')::numeric, 0),
                (record_data->>'license_plate'), (record_data->>'driver_phone'),
                COALESCE((record_data->>'transport_type'), '实际运输'),
                (record_data->>'remarks'),
                driver_payable, 'system'
            ) RETURNING id INTO new_record_id;

            -- 重新计算合作方成本
            PERFORM public.recalculate_and_update_costs_for_record(new_record_id);

            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            errors := errors || jsonb_build_object('error', SQLERRM);
            error_count := error_count + 1;
        END;
    END LOOP;

    -- 返回处理结果
    RETURN jsonb_build_object(
        'success_count', success_count,
        'error_count', error_count,
        'errors', errors
    );
END;
$function$;