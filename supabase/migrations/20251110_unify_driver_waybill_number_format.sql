-- ============================================================================
-- 统一司机端运单编号格式
-- 创建时间：2025-11-10
-- 功能：将司机端快速建单和手工建单的运单编号格式统一为 YDN + YYYYMMDD + - + 3位序号
-- ============================================================================

-- 更新 driver_quick_create_waybill 函数：只修改运单编号生成规则
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
SET search_path TO public
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_info RECORD;
    v_drivers_table_id UUID;
    v_vehicle_info RECORD;
    v_project_info RECORD;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_auto_number TEXT;
    v_new_id UUID;
    v_chain_id UUID;
    v_billing_type_id BIGINT := 1;
    v_temp_license_plate TEXT;
BEGIN
    v_driver_id := get_current_driver_id();
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;

    SELECT id, name, phone INTO v_driver_info FROM internal_drivers WHERE id = v_driver_id;
    IF v_driver_info.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '司机信息不存在');
    END IF;

    SELECT id INTO v_drivers_table_id
    FROM drivers
    WHERE name = v_driver_info.name
      AND phone = v_driver_info.phone
      AND driver_type = 'internal'
    LIMIT 1;

    IF v_drivers_table_id IS NULL THEN
        SELECT v.license_plate INTO v_temp_license_plate
        FROM internal_vehicles v
        INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
        WHERE dvr.driver_id = v_driver_id
        AND dvr.valid_until IS NULL
        AND v.is_active = true
        ORDER BY dvr.valid_from DESC
        LIMIT 1;
        
        INSERT INTO drivers (name, phone, license_plate, driver_type, created_at, updated_at)
        VALUES (v_driver_info.name, v_driver_info.phone, COALESCE(v_temp_license_plate, ''), 'internal', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_drivers_table_id;
        
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

    SELECT v.id, v.license_plate INTO v_vehicle_info
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND dvr.valid_until IS NULL
    AND v.is_active = true
    ORDER BY dvr.valid_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    IF v_vehicle_info.license_plate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;

    SELECT id, name INTO v_project_info FROM projects WHERE id = p_project_id;
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;

    SELECT name INTO v_loading_location FROM locations WHERE id = p_loading_location_id;
    SELECT name INTO v_unloading_location FROM locations WHERE id = p_unloading_location_id;
    IF v_loading_location IS NULL OR v_unloading_location IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '地点不存在');
    END IF;

    IF p_chain_id IS NOT NULL THEN
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE id = p_chain_id AND project_id = p_project_id;
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE project_id = p_project_id AND is_default = true
        LIMIT 1;
        IF v_chain_id IS NULL THEN
            SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
            FROM partner_chains
            WHERE project_id = p_project_id
            ORDER BY created_at
            LIMIT 1;
        END IF;
    END IF;

    IF v_chain_id IS NULL THEN
        v_billing_type_id := 1;
    END IF;

    -- ✅ 调用现有的 generate_auto_number 函数生成标准运单编号格式
    v_auto_number := public.generate_auto_number(p_loading_date::TEXT);

    INSERT INTO logistics_records (
        auto_number, project_id, project_name, driver_id, driver_name, driver_phone, license_plate,
        loading_location, unloading_location, loading_location_ids, unloading_location_ids,
        loading_date, unloading_date, loading_weight, unloading_weight, transport_type,
        billing_type_id, chain_id, payment_status, invoice_status, remarks, created_by_user_id
    ) VALUES (
        v_auto_number, p_project_id, v_project_info.name, v_drivers_table_id, v_driver_info.name, v_driver_info.phone, v_vehicle_info.license_plate,
        v_loading_location, v_unloading_location,
        ARRAY[p_loading_location_id], ARRAY[p_unloading_location_id],
        (p_loading_date::text || ' 00:00:00')::timestamp with time zone,
        (COALESCE(p_unloading_date, p_loading_date)::text || ' 00:00:00')::timestamp with time zone,
        p_loading_weight, COALESCE(p_unloading_weight, p_loading_weight), '实际运输',
        v_billing_type_id, v_chain_id, 'Unpaid', 'Uninvoiced', p_remarks, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true, 'message', '运单创建成功', 'waybill_id', v_new_id,
        'auto_number', v_auto_number, 'driver_name', v_driver_info.name,
        'vehicle', v_vehicle_info.license_plate, 'chain_id', v_chain_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', '创建运单失败：' || SQLERRM);
END;
$$;

-- 更新 driver_manual_create_waybill 函数：只修改运单编号生成规则
CREATE OR REPLACE FUNCTION driver_manual_create_waybill(
    p_project_id UUID,
    p_loading_weight NUMERIC,
    p_loading_location_id UUID DEFAULT NULL,
    p_unloading_location_id UUID DEFAULT NULL,
    p_loading_location TEXT DEFAULT NULL,
    p_unloading_location TEXT DEFAULT NULL,
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
    v_drivers_table_id UUID;
    v_vehicle_info RECORD;
    v_project_info RECORD;
    v_final_loading_location TEXT;
    v_final_unloading_location TEXT;
    v_auto_number TEXT;
    v_new_id UUID;
    v_chain_id UUID;
    v_billing_type_id BIGINT := 1;
    v_temp_license_plate TEXT;
    v_location_name TEXT;
BEGIN
    v_driver_id := get_current_driver_id();
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;

    SELECT id, name, phone INTO v_driver_info FROM internal_drivers WHERE id = v_driver_id;
    IF v_driver_info.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '司机信息不存在');
    END IF;

    SELECT id INTO v_drivers_table_id
    FROM drivers
    WHERE name = v_driver_info.name
      AND phone = v_driver_info.phone
      AND driver_type = 'internal'
    LIMIT 1;

    IF v_drivers_table_id IS NULL THEN
        SELECT v.license_plate INTO v_temp_license_plate
        FROM internal_vehicles v
        INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
        WHERE dvr.driver_id = v_driver_id
        AND dvr.valid_until IS NULL
        AND v.is_active = true
        ORDER BY dvr.valid_from DESC
        LIMIT 1;
        
        INSERT INTO drivers (name, phone, license_plate, driver_type, created_at, updated_at)
        VALUES (v_driver_info.name, v_driver_info.phone, COALESCE(v_temp_license_plate, ''), 'internal', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_drivers_table_id;
        
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

    SELECT v.id, v.license_plate INTO v_vehicle_info
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND dvr.valid_until IS NULL
    AND v.is_active = true
    ORDER BY dvr.valid_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    IF v_vehicle_info.license_plate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;

    SELECT id, name INTO v_project_info FROM projects WHERE id = p_project_id;
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;

    IF p_loading_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name FROM locations WHERE id = p_loading_location_id;
        IF v_location_name IS NOT NULL THEN
            v_final_loading_location := v_location_name;
        ELSE
            v_final_loading_location := COALESCE(p_loading_location, '');
        END IF;
    ELSE
        v_final_loading_location := COALESCE(p_loading_location, '');
    END IF;

    IF p_unloading_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name FROM locations WHERE id = p_unloading_location_id;
        IF v_location_name IS NOT NULL THEN
            v_final_unloading_location := v_location_name;
        ELSE
            v_final_unloading_location := COALESCE(p_unloading_location, '');
        END IF;
    ELSE
        v_final_unloading_location := COALESCE(p_unloading_location, '');
    END IF;

    IF v_final_loading_location IS NULL OR v_final_loading_location = '' THEN
        RETURN jsonb_build_object('success', false, 'error', '请填写装货地址');
    END IF;
    IF v_final_unloading_location IS NULL OR v_final_unloading_location = '' THEN
        RETURN jsonb_build_object('success', false, 'error', '请填写卸货地址');
    END IF;

    IF p_chain_id IS NOT NULL THEN
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE id = p_chain_id AND project_id = p_project_id;
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE project_id = p_project_id AND is_default = true
        LIMIT 1;
        IF v_chain_id IS NULL THEN
            SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
            FROM partner_chains
            WHERE project_id = p_project_id
            ORDER BY created_at
            LIMIT 1;
        END IF;
    END IF;

    IF v_chain_id IS NULL THEN
        v_billing_type_id := 1;
    END IF;

    -- ✅ 调用现有的 generate_auto_number 函数生成标准运单编号格式
    v_auto_number := public.generate_auto_number(p_loading_date::TEXT);

    INSERT INTO logistics_records (
        auto_number, project_id, project_name, driver_id, driver_name, driver_phone, license_plate,
        loading_location, unloading_location, loading_location_ids, unloading_location_ids,
        loading_date, unloading_date, loading_weight, unloading_weight, transport_type,
        billing_type_id, chain_id, payment_status, invoice_status, remarks, created_by_user_id
    ) VALUES (
        v_auto_number, p_project_id, v_project_info.name, v_drivers_table_id, v_driver_info.name, v_driver_info.phone, v_vehicle_info.license_plate,
        v_final_loading_location, v_final_unloading_location,
        CASE WHEN p_loading_location_id IS NOT NULL THEN ARRAY[p_loading_location_id] ELSE NULL END,
        CASE WHEN p_unloading_location_id IS NOT NULL THEN ARRAY[p_unloading_location_id] ELSE NULL END,
        (p_loading_date::text || ' 00:00:00')::timestamp with time zone,
        (COALESCE(p_unloading_date, p_loading_date)::text || ' 00:00:00')::timestamp with time zone,
        p_loading_weight, COALESCE(p_unloading_weight, p_loading_weight), '实际运输',
        v_billing_type_id, v_chain_id, 'Unpaid', 'Uninvoiced', p_remarks, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true, 'message', '运单创建成功', 'waybill_id', v_new_id,
        'auto_number', v_auto_number, 'driver_name', v_driver_info.name,
        'vehicle', v_vehicle_info.license_plate, 'chain_id', v_chain_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', '创建运单失败：' || SQLERRM);
END;
$$;
