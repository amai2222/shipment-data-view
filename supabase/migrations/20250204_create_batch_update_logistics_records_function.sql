-- 创建批量更新运单记录的函数
-- 用于选择性字段更新功能，使用CTE一次性批量更新多条记录，避免逐条更新导致超时
-- 优化：先解析所有数据到CTE，然后使用UPDATE FROM进行批量更新，避免在SET子句中使用子查询

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
    -- 优化：将数组字段的解析也移到CTE中，但使用更高效的方式
    WITH update_data_raw AS (
        SELECT 
            (upd->>'id')::uuid AS record_id,
            upd->'data' AS update_data_json
        FROM jsonb_array_elements(p_updates) AS upd
    ),
    update_data AS (
        SELECT 
            udr.record_id,
            -- 解析各个字段，避免在UPDATE的SET子句中解析
            NULLIF((udr.update_data_json->>'unloading_weight'), '')::numeric AS unloading_weight,
            CASE WHEN (udr.update_data_json->>'unloading_date') IS NOT NULL AND (udr.update_data_json->>'unloading_date') != ''
                 THEN ((udr.update_data_json->>'unloading_date') || ' 00:00:00+08:00')::timestamptz 
                 ELSE NULL END AS unloading_date,
            NULLIF((udr.update_data_json->>'current_cost'), '')::numeric AS current_cost,
            NULLIF((udr.update_data_json->>'extra_cost'), '')::numeric AS extra_cost,
            NULLIF((udr.update_data_json->>'remarks'), '')::text AS remarks,
            NULLIF((udr.update_data_json->>'cargo_type'), '')::text AS cargo_type,
            NULLIF((udr.update_data_json->>'license_plate'), '')::text AS license_plate,
            NULLIF((udr.update_data_json->>'driver_phone'), '')::text AS driver_phone,
            -- 数组字段：如果前端已经传入了数组，直接使用；否则尝试解析
            CASE 
                WHEN jsonb_typeof(udr.update_data_json->'other_platform_names') = 'array' 
                THEN ARRAY(SELECT jsonb_array_elements_text(udr.update_data_json->'other_platform_names'))
                ELSE NULL 
            END AS other_platform_names,
            CASE 
                WHEN jsonb_typeof(udr.update_data_json->'external_tracking_numbers') = 'array' 
                THEN ARRAY(SELECT jsonb_array_elements_text(udr.update_data_json->'external_tracking_numbers'))
                ELSE NULL 
            END AS external_tracking_numbers,
            NULLIF((udr.update_data_json->>'transport_type'), '')::text AS transport_type,
            NULLIF((udr.update_data_json->>'chain_id'), '')::uuid AS chain_id
        FROM update_data_raw udr
    ),
    updated_records AS (
        UPDATE public.logistics_records lr
        SET 
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
            updated_at = NOW()
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

