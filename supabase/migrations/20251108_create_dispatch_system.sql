-- ============================================================================
-- 创建派单系统
-- 创建时间: 2025-11-08
-- 功能: 车队长派单 → 司机接单 → 完成运输 → 录入运单
-- ============================================================================

-- ============================================================================
-- 第一步：创建派单表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dispatch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 派单信息
    order_number TEXT NOT NULL UNIQUE,           -- 派单编号：PD + 日期 + 序号
    
    -- 关联信息
    project_id UUID NOT NULL REFERENCES projects(id),
    driver_id UUID NOT NULL REFERENCES internal_drivers(id),
    fleet_manager_id UUID NOT NULL,              -- 派单人（车队长）
    
    -- 线路信息
    loading_location_id UUID REFERENCES locations(id),
    unloading_location_id UUID REFERENCES locations(id),
    loading_location TEXT NOT NULL,              -- 装货地点（冗余字段，方便查询）
    unloading_location TEXT NOT NULL,            -- 卸货地点
    
    -- 预期信息
    expected_loading_date DATE,                  -- 预期装货日期
    expected_weight NUMERIC(10,2),               -- 预期重量
    remarks TEXT,                                -- 备注说明
    
    -- 状态跟踪
    status TEXT DEFAULT 'pending',               -- 状态：pending-待接单, accepted-已接单, completed-已完成, rejected-已拒绝, cancelled-已取消
    
    -- 司机操作
    accepted_at TIMESTAMPTZ,                     -- 接单时间
    rejected_at TIMESTAMPTZ,                     -- 拒绝时间
    reject_reason TEXT,                          -- 拒绝原因
    
    -- 完成信息（司机填写）
    actual_loading_date DATE,                    -- 实际装货日期
    loading_weight NUMERIC(10,2),                -- 实际装货重量
    unloading_weight NUMERIC(10,2),              -- 实际卸货重量
    scale_record_photos JSONB DEFAULT '[]'::jsonb, -- 磅单照片（七牛云URL数组）
    completion_remarks TEXT,                     -- 完成备注
    completed_at TIMESTAMPTZ,                    -- 完成时间
    
    -- 运单关联
    logistics_record_id UUID REFERENCES logistics_records(id), -- 生成的运单ID
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_dispatch_status CHECK (status IN ('pending', 'accepted', 'completed', 'rejected', 'cancelled'))
);

-- 索引（添加 IF NOT EXISTS 避免重复创建）
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_driver ON dispatch_orders(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_fleet_manager ON dispatch_orders(fleet_manager_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_status ON dispatch_orders(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_created_at ON dispatch_orders(created_at DESC);

-- 表注释
COMMENT ON TABLE dispatch_orders IS '派单表 - 车队长派单给司机';
COMMENT ON COLUMN dispatch_orders.order_number IS '派单编号（格式：PD+YYYYMMDD-序号）';
COMMENT ON COLUMN dispatch_orders.status IS '派单状态：pending-待接单, accepted-已接单, completed-已完成, rejected-已拒绝, cancelled-已取消';

-- ============================================================================
-- 第二步：创建常用线路保存表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fleet_manager_favorite_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    fleet_manager_id UUID NOT NULL,              -- 车队长ID
    route_name TEXT NOT NULL,                    -- 线路名称（如：昆明→大理）
    
    -- 线路信息
    project_id UUID REFERENCES projects(id),
    loading_location_id UUID REFERENCES locations(id),
    unloading_location_id UUID REFERENCES locations(id),
    loading_location TEXT NOT NULL,
    unloading_location TEXT NOT NULL,
    
    -- 使用频率
    use_count INTEGER DEFAULT 0,                 -- 使用次数
    last_used_at TIMESTAMPTZ,                    -- 最后使用时间
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ 添加唯一约束（如果表已存在，需要单独添加）
DO $$
BEGIN
    -- 检查约束是否存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_route_per_manager'
        AND conrelid = 'fleet_manager_favorite_routes'::regclass
    ) THEN
        ALTER TABLE fleet_manager_favorite_routes
        ADD CONSTRAINT unique_route_per_manager UNIQUE (fleet_manager_id, route_name);
        RAISE NOTICE '✅ 已添加唯一约束 unique_route_per_manager';
    ELSE
        RAISE NOTICE '⚠️  唯一约束 unique_route_per_manager 已存在';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_favorite_routes_manager ON fleet_manager_favorite_routes(fleet_manager_id);
CREATE INDEX IF NOT EXISTS idx_favorite_routes_use_count ON fleet_manager_favorite_routes(use_count DESC);

COMMENT ON TABLE fleet_manager_favorite_routes IS '车队长常用线路收藏';

-- ============================================================================
-- 第三步：启用 RLS
-- ============================================================================

ALTER TABLE dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_manager_favorite_routes ENABLE ROW LEVEL SECURITY;

-- 派单表 RLS 策略（先删除旧策略）
DROP POLICY IF EXISTS "dispatch_select_policy" ON dispatch_orders;
DROP POLICY IF EXISTS "dispatch_insert_policy" ON dispatch_orders;
DROP POLICY IF EXISTS "dispatch_update_policy" ON dispatch_orders;

CREATE POLICY "dispatch_select_policy"
ON dispatch_orders
FOR SELECT
TO authenticated
USING (
    -- 司机：只能看自己的派单
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长：可以看自己派出的单
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
    OR
    -- 管理员：看全部
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "dispatch_insert_policy"
ON dispatch_orders
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
    AND fleet_manager_id = auth.uid()
);

CREATE POLICY "dispatch_update_policy"
ON dispatch_orders
FOR UPDATE
TO authenticated
USING (
    -- 司机可以更新自己的派单（接单、完成）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长可以更新自己的派单（取消）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
    OR
    -- 管理员可以更新全部
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 常用线路 RLS 策略（先删除旧策略）
DROP POLICY IF EXISTS "favorite_routes_policy" ON fleet_manager_favorite_routes;

CREATE POLICY "favorite_routes_policy"
ON fleet_manager_favorite_routes
FOR ALL
TO authenticated
USING (fleet_manager_id = auth.uid())
WITH CHECK (fleet_manager_id = auth.uid());

-- ============================================================================
-- 第四步：创建派单 RPC 函数
-- ============================================================================

-- 车队长创建派单
CREATE OR REPLACE FUNCTION create_dispatch_order(
    p_project_id UUID,
    p_driver_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_expected_loading_date DATE DEFAULT NULL,
    p_expected_weight NUMERIC DEFAULT NULL,
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
    
    -- 创建派单
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

-- 司机接受派单
CREATE OR REPLACE FUNCTION accept_dispatch_order(
    p_order_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '未找到司机档案'
        );
    END IF;
    
    -- 更新派单状态
    UPDATE dispatch_orders
    SET status = 'accepted',
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id
      AND driver_id = v_driver_id
      AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', '派单不存在或已被处理'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', '接单成功'
    );
END;
$$;

-- 司机拒绝派单
CREATE OR REPLACE FUNCTION reject_dispatch_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '未找到司机档案'
        );
    END IF;
    
    UPDATE dispatch_orders
    SET status = 'rejected',
        rejected_at = NOW(),
        reject_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id
      AND driver_id = v_driver_id
      AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', '派单不存在或已被处理'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', '已拒绝派单'
    );
END;
$$;

-- 司机完成派单并创建运单
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
    
    -- 获取派单信息
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
    
    -- 生成运单编号
    v_auto_number := 'YD' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                     LPAD((
                         SELECT COUNT(*) + 1 
                         FROM logistics_records 
                         WHERE created_at::DATE = CURRENT_DATE
                     )::TEXT, 4, '0');
    
    -- 创建运单记录
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
        transport_type,
        remarks,
        invoice_status,
        payment_status
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
        '实际运输',
        COALESCE(p_completion_remarks, v_order.remarks),
        'Uninvoiced',
        'Unpaid'
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
        'message', '运单已创建',
        'logistics_id', v_logistics_id,
        'auto_number', v_auto_number
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '操作失败: ' || SQLERRM
    );
END;
$$;

-- 保存常用线路
CREATE OR REPLACE FUNCTION save_favorite_route(
    p_route_name TEXT,
    p_project_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loading_location TEXT;
    v_unloading_location TEXT;
BEGIN
    -- 权限检查
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足'
        );
    END IF;
    
    -- 获取地点名称
    SELECT name INTO v_loading_location FROM locations WHERE id = p_loading_location_id;
    SELECT name INTO v_unloading_location FROM locations WHERE id = p_unloading_location_id;
    
    -- 插入或更新（使用唯一约束名称）
    INSERT INTO fleet_manager_favorite_routes (
        fleet_manager_id,
        route_name,
        project_id,
        loading_location_id,
        unloading_location_id,
        loading_location,
        unloading_location,
        use_count
    ) VALUES (
        auth.uid(),
        p_route_name,
        p_project_id,
        p_loading_location_id,
        p_unloading_location_id,
        v_loading_location,
        v_unloading_location,
        1
    )
    ON CONFLICT ON CONSTRAINT unique_route_per_manager
    DO UPDATE SET
        project_id = EXCLUDED.project_id,
        loading_location_id = EXCLUDED.loading_location_id,
        unloading_location_id = EXCLUDED.unloading_location_id,
        loading_location = EXCLUDED.loading_location,
        unloading_location = EXCLUDED.unloading_location,
        updated_at = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', '线路已保存'
    );
END;
$$;

-- 获取我的派单（司机）
CREATE OR REPLACE FUNCTION get_my_dispatch_orders(
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    project_name TEXT,
    loading_location TEXT,
    unloading_location TEXT,
    expected_loading_date DATE,
    expected_weight NUMERIC,
    status TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        d.id,
        d.order_number,
        p.name as project_name,
        d.loading_location,
        d.unloading_location,
        d.expected_loading_date,
        d.expected_weight,
        d.status,
        d.remarks,
        d.created_at
    FROM dispatch_orders d
    JOIN projects p ON d.project_id = p.id
    WHERE d.driver_id = v_driver_id
      AND (p_status IS NULL OR d.status = p_status)
    ORDER BY d.created_at DESC;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION create_dispatch_order IS '创建派单（车队长）';
COMMENT ON FUNCTION accept_dispatch_order IS '接受派单（司机）';
COMMENT ON FUNCTION reject_dispatch_order IS '拒绝派单（司机）';
COMMENT ON FUNCTION complete_dispatch_order IS '完成派单并创建运单（司机）';
COMMENT ON FUNCTION save_favorite_route IS '保存常用线路（车队长）';
COMMENT ON FUNCTION get_my_dispatch_orders IS '获取我的派单列表（司机）';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 派单系统创建完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '创建的表：';
    RAISE NOTICE '  1. dispatch_orders - 派单表';
    RAISE NOTICE '  2. fleet_manager_favorite_routes - 常用线路表';
    RAISE NOTICE '';
    RAISE NOTICE '创建的函数：';
    RAISE NOTICE '  1. create_dispatch_order - 车队长派单';
    RAISE NOTICE '  2. accept_dispatch_order - 司机接单';
    RAISE NOTICE '  3. reject_dispatch_order - 司机拒单';
    RAISE NOTICE '  4. complete_dispatch_order - 完成派单';
    RAISE NOTICE '  5. save_favorite_route - 保存线路';
    RAISE NOTICE '  6. get_my_dispatch_orders - 获取派单';
    RAISE NOTICE '';
    RAISE NOTICE '📱 下一步：创建前端页面';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

