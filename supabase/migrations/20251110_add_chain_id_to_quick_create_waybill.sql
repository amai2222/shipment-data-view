-- ============================================================================
-- 为driver_quick_create_waybill函数添加chain_id参数支持
-- 创建时间：2025-11-10
-- 功能：支持指定合作链路ID
-- ============================================================================

-- 先删除旧函数（所有可能的重载）
DROP FUNCTION IF EXISTS driver_quick_create_waybill(UUID, UUID, UUID, NUMERIC, NUMERIC, DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS driver_quick_create_waybill(UUID, UUID, UUID, NUMERIC, NUMERIC, DATE, DATE, TEXT, UUID);

-- 重新创建函数，添加chain_id参数
CREATE OR REPLACE FUNCTION driver_quick_create_waybill(
    p_project_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
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
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_info RECORD;
    v_vehicle_info RECORD;
    v_project_info RECORD;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_auto_number TEXT;
    v_new_id UUID;
    v_chain_id UUID;
BEGIN
    -- 1. 获取当前司机ID
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;
    
    -- 2. 获取司机信息
    SELECT 
        id, name, phone
    INTO v_driver_info
    FROM internal_drivers
    WHERE id = v_driver_id;
    
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
    
    IF v_vehicle_info.license_plate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    
    -- 4. 获取项目信息
    SELECT 
        id, name, billing_type_id
    INTO v_project_info
    FROM projects
    WHERE id = p_project_id;
    
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;
    
    -- 5. 处理合作链路ID
    -- 如果传入了chain_id，验证它是否属于该项目
    IF p_chain_id IS NOT NULL THEN
        SELECT id INTO v_chain_id
        FROM partner_chains
        WHERE id = p_chain_id
          AND project_id = p_project_id;
        
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        -- 如果没有指定，尝试获取项目的默认链路
        SELECT id INTO v_chain_id
        FROM partner_chains
        WHERE project_id = p_project_id
          AND is_default = true
        LIMIT 1;
        
        -- 如果还是没有，选择第一个链路
        IF v_chain_id IS NULL THEN
            SELECT id INTO v_chain_id
            FROM partner_chains
            WHERE project_id = p_project_id
            ORDER BY created_at
            LIMIT 1;
        END IF;
    END IF;
    
    -- 6. 获取地点名称
    SELECT name INTO v_loading_location
    FROM locations WHERE id = p_loading_location_id;
    
    SELECT name INTO v_unloading_location
    FROM locations WHERE id = p_unloading_location_id;
    
    -- 7. 生成运单编号
    v_auto_number := generate_waybill_number(p_project_id);
    
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
        v_driver_info.id,
        v_driver_info.name,
        v_driver_info.phone,
        v_vehicle_info.license_plate,
        v_loading_location,
        v_unloading_location,
        ARRAY[p_loading_location_id],
        ARRAY[p_unloading_location_id],
        p_loading_date,
        p_unloading_date,
        p_loading_weight,
        COALESCE(p_unloading_weight, p_loading_weight),  -- 卸货重量默认等于装货
        '单程',
        v_project_info.billing_type_id,
        v_chain_id,  -- 使用确定的合作链路ID
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
END;
$$;

COMMENT ON FUNCTION driver_quick_create_waybill IS '内部司机快速创建运单（支持指定装货和卸货日期、合作链路ID，默认都是当天）';

