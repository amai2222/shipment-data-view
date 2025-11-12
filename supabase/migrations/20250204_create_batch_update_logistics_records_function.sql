-- 创建批量更新运单记录的函数
-- 用于选择性字段更新功能，使用CTE一次性批量更新多条记录，避免逐条更新导致超时
-- 注意：预览阶段已经验重并找到了匹配的运单，这里直接更新即可，不需要再次验重
-- 性能优化：使用 COALESCE 直接更新，避免 IS DISTINCT FROM 的性能问题
-- 前端已经只传入有值的字段，所以不需要在数据库层面再次比较字段值是否不同

CREATE OR REPLACE FUNCTION public.batch_update_logistics_records(
    p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_error_details jsonb := '[]'::jsonb;
    v_updated_ids uuid[];
BEGIN
    -- 使用CTE先解析所有更新数据，然后批量更新
    -- 优化：简化数组字段处理，直接使用前端传入的数组格式
    WITH update_data AS (
        SELECT 
            (upd->>'id')::uuid AS record_id,
            -- 解析各个字段，只解析需要更新的字段
            CASE WHEN upd->'data'->>'unloading_weight' IS NOT NULL AND (upd->'data'->>'unloading_weight') != ''
                 THEN (upd->'data'->>'unloading_weight')::numeric 
                 ELSE NULL END AS unloading_weight,
            CASE WHEN upd->'data'->>'unloading_date' IS NOT NULL AND (upd->'data'->>'unloading_date') != ''
                 THEN ((upd->'data'->>'unloading_date') || ' 00:00:00+08:00')::timestamptz 
                 ELSE NULL END AS unloading_date,
            CASE WHEN upd->'data'->>'current_cost' IS NOT NULL AND (upd->'data'->>'current_cost') != ''
                 THEN (upd->'data'->>'current_cost')::numeric 
                 ELSE NULL END AS current_cost,
            CASE WHEN upd->'data'->>'extra_cost' IS NOT NULL AND (upd->'data'->>'extra_cost') != ''
                 THEN (upd->'data'->>'extra_cost')::numeric 
                 ELSE NULL END AS extra_cost,
            CASE WHEN upd->'data'->>'remarks' IS NOT NULL AND (upd->'data'->>'remarks') != ''
                 THEN upd->'data'->>'remarks' 
                 ELSE NULL END AS remarks,
            CASE WHEN upd->'data'->>'cargo_type' IS NOT NULL AND (upd->'data'->>'cargo_type') != ''
                 THEN upd->'data'->>'cargo_type' 
                 ELSE NULL END AS cargo_type,
            CASE WHEN upd->'data'->>'license_plate' IS NOT NULL AND (upd->'data'->>'license_plate') != ''
                 THEN upd->'data'->>'license_plate' 
                 ELSE NULL END AS license_plate,
            CASE WHEN upd->'data'->>'driver_phone' IS NOT NULL AND (upd->'data'->>'driver_phone') != ''
                 THEN upd->'data'->>'driver_phone' 
                 ELSE NULL END AS driver_phone,
            -- 数组字段：前端已经传入了数组格式，直接转换
            CASE 
                WHEN upd->'data'->'other_platform_names' IS NOT NULL 
                     AND jsonb_typeof(upd->'data'->'other_platform_names') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(upd->'data'->'other_platform_names'))
                ELSE NULL 
            END AS other_platform_names,
            CASE 
                WHEN upd->'data'->'external_tracking_numbers' IS NOT NULL 
                     AND jsonb_typeof(upd->'data'->'external_tracking_numbers') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(upd->'data'->'external_tracking_numbers'))
                ELSE NULL 
            END AS external_tracking_numbers,
            CASE WHEN upd->'data'->>'transport_type' IS NOT NULL AND (upd->'data'->>'transport_type') != ''
                 THEN upd->'data'->>'transport_type' 
                 ELSE NULL END AS transport_type,
            CASE WHEN upd->'data'->>'chain_id' IS NOT NULL AND (upd->'data'->>'chain_id') != ''
                 THEN (upd->'data'->>'chain_id')::uuid 
                 ELSE NULL END AS chain_id
        FROM jsonb_array_elements(p_updates) AS upd
    ),
    updated_records AS (
        UPDATE public.logistics_records lr
        SET 
            -- 简化逻辑：前端已经只传入有值的字段，直接更新即可
            -- 使用 COALESCE 确保：如果有新值就用新值，否则保持原值
            -- 这样避免了 IS DISTINCT FROM 的性能问题
            unloading_weight = COALESCE(ud.unloading_weight, lr.unloading_weight),
            unloading_date = COALESCE(ud.unloading_date, lr.unloading_date),
            current_cost = COALESCE(ud.current_cost, lr.current_cost),
            extra_cost = COALESCE(ud.extra_cost, lr.extra_cost),
            remarks = COALESCE(ud.remarks, lr.remarks),
            cargo_type = COALESCE(ud.cargo_type, lr.cargo_type),
            license_plate = COALESCE(ud.license_plate, lr.license_plate),
            driver_phone = COALESCE(ud.driver_phone, lr.driver_phone),
            other_platform_names = COALESCE(ud.other_platform_names, lr.other_platform_names),
            external_tracking_numbers = COALESCE(ud.external_tracking_numbers, lr.external_tracking_numbers),
            transport_type = COALESCE(ud.transport_type, lr.transport_type),
            chain_id = COALESCE(ud.chain_id, lr.chain_id),
            -- 只要有任何一个字段有值，就更新 updated_at
            updated_at = CASE 
                WHEN ud.unloading_weight IS NOT NULL 
                     OR ud.unloading_date IS NOT NULL 
                     OR ud.current_cost IS NOT NULL 
                     OR ud.extra_cost IS NOT NULL 
                     OR ud.remarks IS NOT NULL 
                     OR ud.cargo_type IS NOT NULL 
                     OR ud.license_plate IS NOT NULL 
                     OR ud.driver_phone IS NOT NULL 
                     OR ud.other_platform_names IS NOT NULL 
                     OR ud.external_tracking_numbers IS NOT NULL 
                     OR ud.transport_type IS NOT NULL 
                     OR ud.chain_id IS NOT NULL
                THEN NOW()
                ELSE lr.updated_at
            END
        FROM update_data ud
        WHERE lr.id = ud.record_id
        RETURNING lr.id
    )
    SELECT array_agg(id) INTO v_updated_ids FROM updated_records;
    
    -- 计算成功和失败数量
    v_success_count := COALESCE(array_length(v_updated_ids, 1), 0);
    v_error_count := jsonb_array_length(p_updates) - v_success_count;
    
    -- 找出失败的记录ID
    IF v_error_count > 0 THEN
        WITH update_data AS (
            SELECT 
                (upd->>'id')::uuid AS record_id
            FROM jsonb_array_elements(p_updates) AS upd
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'record_id', ud.record_id,
                'error_message', '记录不存在或更新失败'
            )
        ) INTO v_error_details
        FROM update_data ud
        WHERE ud.record_id NOT IN (SELECT unnest(v_updated_ids));
    END IF;
    
    -- 返回结果
    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'error_details', COALESCE(v_error_details, '[]'::jsonb)
    );
EXCEPTION WHEN OTHERS THEN
    -- 如果批量更新失败，返回错误信息
    RETURN jsonb_build_object(
        'success_count', 0,
        'error_count', jsonb_array_length(p_updates),
        'error_details', jsonb_build_array(
            jsonb_build_object(
                'error_message', '批量更新失败: ' || SQLERRM
            )
        )
    );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.batch_update_logistics_records(jsonb) IS 
'批量更新运单记录，用于选择性字段更新功能。参数格式：[{"id": "uuid", "data": {"field1": "value1", ...}}, ...]';

-- 完成提示
SELECT '批量更新函数创建完成！' as message;

