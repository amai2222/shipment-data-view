-- ============================================================================
-- 创建手工建单函数（支持地址文本输入或选择已有地点）
-- 创建时间：2025-11-10
-- 功能：司机手工创建运单，支持直接输入地址文本或选择已有地点
-- ============================================================================

-- 创建手工建单函数
CREATE OR REPLACE FUNCTION driver_manual_create_waybill(
    p_project_id UUID,
    p_loading_location TEXT,  -- 装货地址（可以是文本或从ID查询）
    p_unloading_location TEXT,  -- 卸货地址（可以是文本或从ID查询）
    p_loading_location_id UUID DEFAULT NULL,  -- 装货地点ID（可选，如果提供则从locations表查询名称）
    p_unloading_location_id UUID DEFAULT NULL,  -- 卸货地点ID（可选，如果提供则从locations表查询名称）
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC DEFAULT NULL,
    p_loading_date DATE DEFAULT CURRENT_DATE,
    p_unloading_date DATE DEFAULT CURRENT_DATE,
    p_remarks TEXT DEFAULT NULL,
    p_chain_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_info RECORD;
    v_drivers_table_id UUID;  -- drivers表中的ID（用于外键）
    v_vehicle_info RECORD;
    v_project_info RECORD;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_auto_number TEXT;
    v_new_id UUID;
    v_chain_id UUID;
    v_billing_type_id BIGINT := 1;  -- 默认值为1，确保不为NULL
    v_temp_license_plate TEXT;  -- 临时变量用于获取车牌号
    v_location_name TEXT;  -- 临时变量用于查询地点名称
BEGIN
    -- 1. 获取当前司机ID
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;
    
    -- 2. 获取司机信息（从internal_drivers表）
    SELECT 
        id, name, phone
    INTO v_driver_info
    FROM internal_drivers
    WHERE id = v_driver_id;
    
    IF v_driver_info.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '司机信息不存在');
    END IF;
    
    -- 2.1 查找drivers表中对应的ID（用于外键约束）
    SELECT id INTO v_drivers_table_id
    FROM drivers
    WHERE name = v_driver_info.name
      AND phone = v_driver_info.phone
      AND driver_type = 'internal'
    LIMIT 1;
    
    -- 如果drivers表中没有，尝试创建（触发器应该会自动创建，但以防万一）
    IF v_drivers_table_id IS NULL THEN
        -- 获取车牌号
        SELECT v.license_plate INTO v_temp_license_plate
        FROM internal_vehicles v
        INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
        WHERE dvr.driver_id = v_driver_id
        AND dvr.valid_until IS NULL
        AND v.is_active = true
        ORDER BY dvr.valid_from DESC
        LIMIT 1;
        
        -- 插入到drivers表
        INSERT INTO drivers (name, phone, license_plate, driver_type, created_at, updated_at)
        VALUES (v_driver_info.name, v_driver_info.phone, COALESCE(v_temp_license_plate, ''), 'internal', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_drivers_table_id;
        
        -- 如果还是NULL，再次查询
        IF v_drivers_table_id IS NULL THEN
            SELECT id INTO v_drivers_table_id
            FROM drivers
            WHERE name = v_driver_info.name
              AND phone = v_driver_info.phone
            LIMIT 1;
        END IF;
    END IF;
    
    IF v_drivers_table_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '无法在司机表中找到对应记录，请联系管理员');
    END IF;
    
    -- 3. 获取司机的主车信息
    SELECT 
        v.id, v.license_plate
    INTO v_vehicle_info
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND dvr.valid_until IS NULL  -- 当前有效的分配
    AND v.is_active = true
    ORDER BY dvr.valid_from DESC
    LIMIT 1;
    
    -- 检查是否成功获取车辆信息（使用FOUND检查SELECT是否返回了记录）
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    
    -- 如果找到了记录，再检查车牌号是否为空
    IF v_vehicle_info.license_plate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    
    -- 4. 获取项目信息
    SELECT 
        id, name
    INTO v_project_info
    FROM projects
    WHERE id = p_project_id;
    
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;
    
    -- 5. 处理合作链路ID并获取billing_type_id
    -- 如果传入了chain_id，验证它是否属于该项目并获取billing_type_id
    IF p_chain_id IS NOT NULL THEN
        SELECT 
            id, 
            COALESCE(billing_type_id, 1)  -- 如果billing_type_id为NULL，使用默认值1
        INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE id = p_chain_id
          AND project_id = p_project_id;
        
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        -- 如果没有指定，尝试获取项目的默认链路
        SELECT 
            id, 
            COALESCE(billing_type_id, 1)  -- 如果billing_type_id为NULL，使用默认值1
        INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE project_id = p_project_id
          AND is_default = true
        LIMIT 1;
        
        -- 如果还是没有，选择第一个链路
        IF v_chain_id IS NULL THEN
            SELECT 
                id, 
                COALESCE(billing_type_id, 1)  -- 如果billing_type_id为NULL，使用默认值1
            INTO v_chain_id, v_billing_type_id
            FROM partner_chains
            WHERE project_id = p_project_id
            ORDER BY created_at
            LIMIT 1;
        END IF;
    END IF;
    
    -- 如果仍然没有找到链路，使用默认值
    IF v_chain_id IS NULL THEN
        -- 允许没有链路的情况，使用默认billing_type_id
        v_chain_id := NULL;
        v_billing_type_id := 1;
    END IF;
    
    -- 确保billing_type_id不为NULL（双重保险）
    v_billing_type_id := COALESCE(v_billing_type_id, 1);
    
    -- 6. 处理装货和卸货地址
    -- 如果提供了location_id，优先从locations表查询名称
    -- 否则使用直接传入的地址文本
    
    -- 6.1 处理装货地址
    IF p_loading_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name
        FROM locations
        WHERE id = p_loading_location_id;
        
        IF v_location_name IS NOT NULL THEN
            v_loading_location := v_location_name;
        ELSE
            -- 如果ID对应的地点不存在，使用传入的文本
            v_loading_location := COALESCE(p_loading_location, '');
        END IF;
    ELSE
        -- 没有提供ID，直接使用传入的文本
        v_loading_location := COALESCE(p_loading_location, '');
    END IF;
    
    -- 6.2 处理卸货地址
    IF p_unloading_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name
        FROM locations
        WHERE id = p_unloading_location_id;
        
        IF v_location_name IS NOT NULL THEN
            v_unloading_location := v_location_name;
        ELSE
            -- 如果ID对应的地点不存在，使用传入的文本
            v_unloading_location := COALESCE(p_unloading_location, '');
        END IF;
    ELSE
        -- 没有提供ID，直接使用传入的文本
        v_unloading_location := COALESCE(p_unloading_location, '');
    END IF;
    
    -- 验证地址不为空
    IF v_loading_location IS NULL OR v_loading_location = '' THEN
        RETURN jsonb_build_object('success', false, 'error', '请填写装货地址');
    END IF;
    
    IF v_unloading_location IS NULL OR v_unloading_location = '' THEN
        RETURN jsonb_build_object('success', false, 'error', '请填写卸货地址');
    END IF;
    
    -- 7. 生成运单编号
    v_auto_number := (
        SELECT COALESCE(MAX(CAST(SUBSTRING(auto_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
        FROM logistics_records
        WHERE project_id = p_project_id
    )::TEXT;
    
    v_auto_number := v_project_info.name || '-' || LPAD(v_auto_number, 6, '0');
    
    -- 8. 插入运单记录
    INSERT INTO logistics_records (
        auto_number,
        project_id,
        project_name,
        driver_id,
        driver_name,
        driver_phone,
        license_plate,
        loading_location,
        unloading_location,
        loading_location_ids,
        unloading_location_ids,
        loading_date,
        unloading_date,
        loading_weight,
        unloading_weight,
        transport_type,
        billing_type_id,
        chain_id,
        payment_status,
        invoice_status,
        remarks,
        created_by_user_id
    ) VALUES (
        v_auto_number,
        p_project_id,
        v_project_info.name,
        v_drivers_table_id,  -- 使用drivers表的ID（满足外键约束）
        v_driver_info.name,
        v_driver_info.phone,
        v_vehicle_info.license_plate,
        v_loading_location,
        v_unloading_location,
        CASE WHEN p_loading_location_id IS NOT NULL THEN ARRAY[p_loading_location_id] ELSE ARRAY[]::UUID[] END,  -- 如果有ID则使用，否则为空数组
        CASE WHEN p_unloading_location_id IS NOT NULL THEN ARRAY[p_unloading_location_id] ELSE ARRAY[]::UUID[] END,  -- 如果有ID则使用，否则为空数组
        (p_loading_date::text || ' 00:00:00')::timestamp with time zone,  -- 将DATE转换为timestamp with time zone
        (COALESCE(p_unloading_date, p_loading_date)::text || ' 00:00:00')::timestamp with time zone,  -- 将DATE转换为timestamp with time zone
        p_loading_weight,
        COALESCE(p_unloading_weight, p_loading_weight),  -- 卸货重量默认等于装货
        '实际运输',  -- 运输类型：实际运输、退货、内部派单等
        v_billing_type_id,  -- 使用合作链路的计费类型ID（已确保不为NULL）
        v_chain_id,  -- 使用确定的合作链路ID（可能为NULL）
        'Unpaid',
        'Uninvoiced',
        p_remarks,
        auth.uid()
    ) RETURNING id INTO v_new_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '运单创建成功',
        'waybill_id', v_new_id,
        'auto_number', v_auto_number,
        'driver_name', v_driver_info.name,
        'vehicle', v_vehicle_info.license_plate,
        'chain_id', v_chain_id
    );
EXCEPTION
    WHEN OTHERS THEN
        -- 捕获所有异常并返回友好的错误信息
        RETURN jsonb_build_object(
            'success', false,
            'error', '创建运单失败：' || SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION driver_manual_create_waybill IS '司机手工创建运单（支持直接输入地址文本或选择已有地点，支持指定装货和卸货日期、合作链路ID）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION driver_manual_create_waybill TO authenticated;
GRANT EXECUTE ON FUNCTION driver_manual_create_waybill TO anon;

