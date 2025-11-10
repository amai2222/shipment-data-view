-- ============================================================
-- 为派单系统添加运费字段
-- ============================================================
-- 创建时间: 2025-11-10
-- 功能: 在 dispatch_orders 表中添加 expected_cost 字段
--       修改 create_dispatch_order 函数支持运费参数
--       修改 complete_dispatch_order 函数使用派单中的运费
-- ============================================================

BEGIN;

-- ============================================================
-- 第一步：添加运费字段到 dispatch_orders 表
-- ============================================================

ALTER TABLE public.dispatch_orders
ADD COLUMN IF NOT EXISTS expected_cost NUMERIC(12,2) DEFAULT 0;

COMMENT ON COLUMN public.dispatch_orders.expected_cost IS '预期运费（车队长派单时设置，默认0）';

-- ============================================================
-- 第二步：修改 create_dispatch_order 函数，添加运费参数
-- ============================================================

-- 🔧 先删除旧版本的函数（避免函数重载冲突）
DROP FUNCTION IF EXISTS create_dispatch_order(UUID, UUID, UUID, UUID, DATE, NUMERIC, TEXT);

-- 创建新版本的函数（带运费参数）
CREATE OR REPLACE FUNCTION create_dispatch_order(
    p_project_id UUID,
    p_driver_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_expected_loading_date DATE DEFAULT NULL,
    p_expected_weight NUMERIC DEFAULT NULL,
    p_current_cost NUMERIC DEFAULT 0,  -- 🔧 新增：运费参数
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_number TEXT;
    v_order_id UUID;
    v_loading_location TEXT;
    v_unloading_location TEXT;
BEGIN
    -- 权限检查
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有车队长或管理员可以派单'
        );
    END IF;
    
    -- 生成派单编号
    v_order_number := 'PD' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                      LPAD((
                          SELECT COUNT(*) + 1 
                          FROM dispatch_orders 
                          WHERE created_at::DATE = CURRENT_DATE
                      )::TEXT, 4, '0');
    
    -- 获取地点名称
    SELECT name INTO v_loading_location FROM locations WHERE id = p_loading_location_id;
    SELECT name INTO v_unloading_location FROM locations WHERE id = p_unloading_location_id;
    
    -- 创建派单（🔧 添加运费字段）
    INSERT INTO dispatch_orders (
        order_number,
        project_id,
        driver_id,
        fleet_manager_id,
        loading_location_id,
        unloading_location_id,
        loading_location,
        unloading_location,
        expected_loading_date,
        expected_weight,
        expected_cost,  -- 🔧 新增：预期运费
        remarks,
        status
    ) VALUES (
        v_order_number,
        p_project_id,
        p_driver_id,
        auth.uid(),
        p_loading_location_id,
        p_unloading_location_id,
        v_loading_location,
        v_unloading_location,
        p_expected_loading_date,
        p_expected_weight,
        COALESCE(p_current_cost, 0),  -- 🔧 使用传入的运费，默认为0
        p_remarks,
        'pending'
    )
    RETURNING id INTO v_order_id;
    
    RETURN json_build_object(
        'success', true,
        'message', '派单成功',
        'order_id', v_order_id,
        'order_number', v_order_number
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '派单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION create_dispatch_order IS '车队长创建派单（已添加运费参数支持）';

-- ============================================================
-- 第三步：修改 complete_dispatch_order 函数，使用派单中的运费
-- ============================================================

CREATE OR REPLACE FUNCTION complete_dispatch_order(
    p_order_id UUID,
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC DEFAULT NULL,
    p_scale_photos TEXT[] DEFAULT NULL,
    p_completion_remarks TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_name TEXT;
    v_order RECORD;
    v_auto_number TEXT;
    v_logistics_id UUID;
    v_project_info RECORD;
    v_license_plate TEXT;
    v_current_cost NUMERIC;  -- 🔧 从派单获取运费
BEGIN
    -- 获取司机信息
    SELECT id, name INTO v_driver_id, v_driver_name
    FROM internal_drivers
    WHERE id = get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '未找到司机档案'
        );
    END IF;
    
    -- 验证装货重量必填
    IF p_loading_weight IS NULL OR p_loading_weight <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', '装货重量必填且必须大于0'
        );
    END IF;
    
    -- 获取派单信息（🔧 包含运费）
    SELECT * INTO v_order
    FROM dispatch_orders
    WHERE id = p_order_id
      AND driver_id = v_driver_id
      AND status = 'accepted';
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', '派单不存在或状态不正确'
        );
    END IF;
    
    -- 获取项目信息
    SELECT name INTO v_project_info
    FROM projects
    WHERE id = v_order.project_id;
    
    -- 获取司机车牌
    SELECT v.license_plate INTO v_license_plate
    FROM internal_driver_vehicle_relations dvr
    JOIN internal_vehicles v ON dvr.vehicle_id = v.id
    WHERE dvr.driver_id = v_driver_id
      AND dvr.valid_until IS NULL
    LIMIT 1;
    
    -- 🔧 从派单获取运费（如果派单中有设置）
    v_current_cost := COALESCE(v_order.expected_cost, 0);
    
    -- 生成运单编号
    v_auto_number := 'YD' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                     LPAD((
                         SELECT COUNT(*) + 1 
                         FROM logistics_records 
                         WHERE created_at::DATE = CURRENT_DATE
                     )::TEXT, 4, '0');
    
    -- 创建运单记录（🔧 使用派单中的运费）
    INSERT INTO logistics_records (
        auto_number,
        project_id,
        project_name,
        driver_name,
        license_plate,
        loading_location,
        unloading_location,
        loading_date,
        loading_weight,
        unloading_weight,
        current_cost,  -- 🔧 使用派单中的运费
        extra_cost,     -- 🔧 默认0
        payable_cost,   -- 🔧 默认等于运费
        transport_type,
        remarks,
        invoice_status,
        payment_status,
        cargo_type,    -- 🔧 从项目获取
        user_id         -- 🔧 当前用户
    ) VALUES (
        v_auto_number,
        v_order.project_id,
        v_project_info.name,
        v_driver_name,
        v_license_plate,
        v_order.loading_location,
        v_order.unloading_location,
        COALESCE(v_order.actual_loading_date, CURRENT_DATE),
        p_loading_weight,
        p_unloading_weight,
        v_current_cost,  -- 🔧 使用派单中的运费
        0,              -- 🔧 额外费用默认为0
        v_current_cost, -- 🔧 应付费用等于运费
        '实际运输',
        COALESCE(p_completion_remarks, v_order.remarks),
        'Uninvoiced',
        'Unpaid',
        (SELECT cargo_type FROM projects WHERE id = v_order.project_id),  -- 🔧 从项目获取
        auth.uid()      -- 🔧 当前用户
    )
    RETURNING id INTO v_logistics_id;
    
    -- 更新派单状态
    UPDATE dispatch_orders
    SET status = 'completed',
        loading_weight = p_loading_weight,
        unloading_weight = p_unloading_weight,
        scale_record_photos = COALESCE(to_jsonb(p_scale_photos), '[]'::jsonb),
        completion_remarks = p_completion_remarks,
        completed_at = NOW(),
        logistics_record_id = v_logistics_id,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'message', '派单完成，运单已创建',
        'logistics_record_id', v_logistics_id,
        'auto_number', v_auto_number
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '完成派单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION complete_dispatch_order IS '司机完成派单并创建运单（已支持使用派单中的运费）';

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复完成：派单系统运费支持';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  1. ✓ 在 dispatch_orders 表中添加 expected_cost 字段';
    RAISE NOTICE '  2. ✓ 删除旧版本 create_dispatch_order 函数（避免重载冲突）';
    RAISE NOTICE '  3. ✓ 修改 create_dispatch_order 函数，添加运费参数';
    RAISE NOTICE '  4. ✓ 修改 complete_dispatch_order 函数，使用派单中的运费';
    RAISE NOTICE '';
    RAISE NOTICE '效果：';
    RAISE NOTICE '  ✅ 车队长派单时可以设置运费（默认0）';
    RAISE NOTICE '  ✅ 司机完成派单时，运单自动使用派单中的运费';
    RAISE NOTICE '  ✅ 运单的运费字段不再是 NULL';
    RAISE NOTICE '========================================';
END $$;

