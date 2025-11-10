-- ============================================================
-- 修复司机创建运单时运费默认值问题
-- ============================================================
-- 创建时间: 2025-11-10
-- 问题: 司机通过移动端创建运单时，current_cost 字段为 NULL
--       导致后续修改项目链路配置时，重算成本失败
-- 解决: 在 driver_manual_create_waybill 函数中，添加 current_cost 
--       和 extra_cost 字段，默认值为 0
-- ============================================================

BEGIN;

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
    -- 获取当前司机ID
    v_driver_id := get_current_driver_id();
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;

    -- 获取司机信息
    SELECT id, name, phone INTO v_driver_info FROM internal_drivers WHERE id = v_driver_id;
    IF v_driver_info.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '司机信息不存在');
    END IF;

    -- 在 drivers 表中查找或创建对应记录
    SELECT id INTO v_drivers_table_id
    FROM drivers
    WHERE name = v_driver_info.name
      AND phone = v_driver_info.phone
      AND driver_type = 'internal'
    LIMIT 1;

    IF v_drivers_table_id IS NULL THEN
        -- 获取司机的车牌号
        SELECT v.license_plate INTO v_temp_license_plate
        FROM internal_vehicles v
        INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
        WHERE dvr.driver_id = v_driver_id
        AND dvr.valid_until IS NULL
        AND v.is_active = true
        ORDER BY dvr.valid_from DESC
        LIMIT 1;
        
        -- 插入到 drivers 表
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

    -- 获取司机的主车信息
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

    -- 获取项目信息
    SELECT id, name INTO v_project_info FROM projects WHERE id = p_project_id;
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;

    -- 处理装货地址
    IF p_loading_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name FROM locations WHERE id = p_loading_location_id;
        v_final_loading_location := COALESCE(v_location_name, p_loading_location);
    ELSE
        v_final_loading_location := p_loading_location;
    END IF;

    IF v_final_loading_location IS NULL OR v_final_loading_location = '' THEN
        RETURN jsonb_build_object('success', false, 'error', '请填写装货地址');
    END IF;

    -- 处理卸货地址
    IF p_unloading_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name FROM locations WHERE id = p_unloading_location_id;
        v_final_unloading_location := COALESCE(v_location_name, p_unloading_location);
    ELSE
        v_final_unloading_location := p_unloading_location;
    END IF;

    IF v_final_unloading_location IS NULL OR v_final_unloading_location = '' THEN
        RETURN jsonb_build_object('success', false, 'error', '请填写卸货地址');
    END IF;

    -- 获取合作链路和计费类型
    IF p_chain_id IS NOT NULL THEN
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE id = p_chain_id AND project_id = p_project_id;
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        -- 查找默认链路
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE project_id = p_project_id AND is_default = true
        LIMIT 1;
        
        -- 如果没有默认链路，取第一个链路
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

    -- 生成运单编号
    v_auto_number := public.generate_auto_number(p_loading_date::TEXT);

    -- 插入运单记录（🔧 修复：补充完整字段）
    INSERT INTO logistics_records (
        auto_number, project_id, project_name, driver_id, driver_name, driver_phone, license_plate,
        loading_location, unloading_location, loading_location_ids, unloading_location_ids,
        loading_date, unloading_date, loading_weight, unloading_weight, transport_type,
        current_cost, extra_cost, payable_cost,  -- 🔧 成本字段
        cargo_type, user_id,  -- 🔧 补充：货物类型、用户ID
        billing_type_id, chain_id, payment_status, invoice_status, remarks, created_by_user_id
    ) VALUES (
        v_auto_number, p_project_id, v_project_info.name, v_drivers_table_id, v_driver_info.name, v_driver_info.phone, v_vehicle_info.license_plate,
        v_final_loading_location, v_final_unloading_location,
        CASE WHEN p_loading_location_id IS NOT NULL THEN ARRAY[p_loading_location_id] ELSE NULL END,
        CASE WHEN p_unloading_location_id IS NOT NULL THEN ARRAY[p_unloading_location_id] ELSE NULL END,
        (p_loading_date::text || ' 00:00:00')::timestamp with time zone,
        (COALESCE(p_unloading_date, p_loading_date)::text || ' 00:00:00')::timestamp with time zone,
        p_loading_weight, COALESCE(p_unloading_weight, p_loading_weight), '实际运输',
        0, 0, 0,  -- 🔧 默认运费、额外费用、应付费用都为 0
        (SELECT cargo_type FROM projects WHERE id = p_project_id),  -- 🔧 从项目获取货物类型
        auth.uid(),  -- 🔧 用户ID
        v_billing_type_id, v_chain_id, 'Unpaid', 'Uninvoiced', p_remarks, auth.uid()
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
        RETURN jsonb_build_object('success', false, 'error', '创建运单失败：' || SQLERRM);
END;
$$;

COMMENT ON FUNCTION driver_manual_create_waybill IS '司机手动创建运单（已修复：默认运费为0而不是NULL）';

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复完成：司机创建运单默认运费问题';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  1. ✓ 添加 current_cost 字段（默认值 0）';
    RAISE NOTICE '  2. ✓ 添加 extra_cost 字段（默认值 0）';
    RAISE NOTICE '  3. ✓ 添加 payable_cost 字段（默认值 0）';
    RAISE NOTICE '  4. ✓ 添加 cargo_type 字段（从项目获取）';
    RAISE NOTICE '  5. ✓ 添加 user_id 字段（当前用户ID）';
    RAISE NOTICE '';
    RAISE NOTICE '效果：';
    RAISE NOTICE '  ✅ 运费字段为 0 而不是 NULL，避免重算失败';
    RAISE NOTICE '  ✅ 自动继承项目的货物类型';
    RAISE NOTICE '  ✅ 记录创建用户，便于权限控制';
    RAISE NOTICE '  ✅ 与运单管理新增逻辑保持一致';
    RAISE NOTICE '========================================';
END $$;

