-- ============================================================================
-- 步骤6：内部司机快速录入运单功能
-- ============================================================================
-- 功能：内部司机（公司自有司机）快速创建运单
-- 适用对象：internal_drivers 表的司机（区别于外部合作司机 drivers 表）
-- 录入方式：只需选择出发地、目的地、装货数量
-- 自动填充：项目、司机姓名、车牌号、电话、装货日期
-- 数据存储：插入 logistics_records 表（与外部司机运单共用）
-- 创建时间：2025-11-04
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：创建司机-项目关联表（司机固定跑哪些线路）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.internal_driver_project_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联关系
    driver_id UUID NOT NULL REFERENCES internal_drivers(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 常用线路信息
    common_loading_location_ids UUID[],      -- 常用装货地点ID数组
    common_unloading_location_ids UUID[],    -- 常用卸货地点ID数组
    
    -- 是否为主线路
    is_primary_route BOOLEAN DEFAULT false,
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_driver_project UNIQUE (driver_id, project_id)
);

CREATE INDEX idx_driver_project_driver ON internal_driver_project_routes(driver_id);
CREATE INDEX idx_driver_project_project ON internal_driver_project_routes(project_id);

COMMENT ON TABLE internal_driver_project_routes IS '内部司机-项目线路关联表（internal_drivers，非外部司机drivers）';
COMMENT ON COLUMN internal_driver_project_routes.driver_id IS '内部司机ID（关联 internal_drivers 表，非 drivers 表）';
COMMENT ON COLUMN internal_driver_project_routes.common_loading_location_ids IS '该司机在该项目的常用装货地点ID数组';
COMMENT ON COLUMN internal_driver_project_routes.common_unloading_location_ids IS '该司机在该项目的常用卸货地点ID数组';

-- ==========================================
-- 第二步：RLS 策略
-- ==========================================

ALTER TABLE internal_driver_project_routes ENABLE ROW LEVEL SECURITY;

-- 司机可以查看自己的项目线路
CREATE POLICY "driver_routes_select_policy"
ON internal_driver_project_routes
FOR SELECT
TO authenticated
USING (
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

-- 只有车队长和管理员可以修改
CREATE POLICY "driver_routes_manage_policy"
ON internal_driver_project_routes
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

-- ==========================================
-- 第三步：获取司机的项目和线路
-- ==========================================

-- 函数：获取我的项目线路（司机专用）
CREATE OR REPLACE FUNCTION get_my_project_routes()
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    is_primary_route BOOLEAN,
    common_loading_locations JSONB,
    common_unloading_locations JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id as project_id,
        p.name as project_name,
        dpr.is_primary_route,
        -- 装货地点信息
        (
            SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name))
            FROM unnest(dpr.common_loading_location_ids) AS loc_id
            JOIN locations l ON l.id = loc_id
        ) as common_loading_locations,
        -- 卸货地点信息
        (
            SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name))
            FROM unnest(dpr.common_unloading_location_ids) AS loc_id
            JOIN locations l ON l.id = loc_id
        ) as common_unloading_locations
    FROM internal_driver_project_routes dpr
    INNER JOIN projects p ON dpr.project_id = p.id
    WHERE dpr.driver_id = v_driver_id
    ORDER BY dpr.is_primary_route DESC, p.name;
END;
$$;

COMMENT ON FUNCTION get_my_project_routes IS '获取我的项目线路（内部司机专用，仅限 driver 角色）';

-- ==========================================
-- 第四步：司机快速创建运单函数
-- ==========================================

CREATE OR REPLACE FUNCTION driver_quick_create_waybill(
    p_project_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL
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
    AND dvr.is_primary = true
    AND v.is_active = true
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
    
    -- 5. 获取地点名称
    SELECT name INTO v_loading_location
    FROM locations WHERE id = p_loading_location_id;
    
    SELECT name INTO v_unloading_location
    FROM locations WHERE id = p_unloading_location_id;
    
    IF v_loading_location IS NULL OR v_unloading_location IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '地点不存在');
    END IF;
    
    -- 6. 生成运单编号
    v_auto_number := (
        SELECT COALESCE(MAX(CAST(SUBSTRING(auto_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
        FROM logistics_records
        WHERE project_id = p_project_id
    )::TEXT;
    
    v_auto_number := v_project_info.name || '-' || LPAD(v_auto_number, 6, '0');
    
    -- 7. 插入运单记录
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
        CURRENT_DATE,                    -- 装货日期：今天
        CURRENT_DATE,                    -- 卸货日期：今天（可后续修改）
        p_loading_weight,
        COALESCE(p_unloading_weight, p_loading_weight),  -- 卸货重量默认等于装货
        '单程',
        v_project_info.billing_type_id,
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
        'vehicle', v_vehicle_info.license_plate
    );
END;
$$;

COMMENT ON FUNCTION driver_quick_create_waybill IS '内部司机快速创建运单（自动关联 internal_drivers 司机档案、车辆、项目，插入 logistics_records 表）';

-- ==========================================
-- 第五步：获取司机的运单记录
-- ==========================================

CREATE OR REPLACE FUNCTION get_my_waybills(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    auto_number TEXT,
    project_name TEXT,
    loading_location TEXT,
    unloading_location TEXT,
    loading_date DATE,
    loading_weight NUMERIC,
    unloading_weight NUMERIC,
    payment_status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_info RECORD;
BEGIN
    -- 获取司机信息
    SELECT id, name INTO v_driver_info
    FROM internal_drivers
    WHERE id = get_current_driver_id();
    
    IF v_driver_info.name IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        lr.id,
        lr.auto_number,
        lr.project_name,
        lr.loading_location,
        lr.unloading_location,
        lr.loading_date::DATE,
        lr.loading_weight,
        lr.unloading_weight,
        lr.payment_status,
        lr.created_at
    FROM logistics_records lr
    WHERE lr.driver_name = v_driver_info.name  -- 通过姓名关联
    AND lr.loading_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ORDER BY lr.loading_date DESC, lr.created_at DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_my_waybills IS '获取我的运单记录（内部司机专用，通过姓名匹配 logistics_records.driver_name）';

-- ==========================================
-- 第六步：验证设置
-- ==========================================

DO $$
DECLARE
    v_route_table_exists BOOLEAN;
    v_function_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'internal_driver_project_routes'
    ) INTO v_route_table_exists;
    
    SELECT COUNT(*) INTO v_function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
        'get_my_project_routes',
        'driver_quick_create_waybill',
        'get_my_waybills'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 内部司机快速录入功能创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 适用对象：';
    RAISE NOTICE '  - 内部司机（internal_drivers 表）';
    RAISE NOTICE '  - 登录角色：driver';
    RAISE NOTICE '  - 与外部合作司机（drivers 表）完全独立';
    RAISE NOTICE '';
    RAISE NOTICE '新建表：';
    RAISE NOTICE '  - internal_driver_project_routes（内部司机项目线路）: %', CASE WHEN v_route_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '';
    RAISE NOTICE '新增函数: % 个', v_function_count;
    RAISE NOTICE '  1. get_my_project_routes() - 获取我的项目线路（内部司机）';
    RAISE NOTICE '  2. driver_quick_create_waybill() - 快速创建运单（内部司机）';
    RAISE NOTICE '  3. get_my_waybills() - 获取我的运单（内部司机）';
    RAISE NOTICE '';
    RAISE NOTICE '数据存储：';
    RAISE NOTICE '  ✅ 运单数据插入 logistics_records 表（与外部司机共用）';
    RAISE NOTICE '  ✅ 通过 driver_name 字段区分内部/外部司机';
    RAISE NOTICE '';
    RAISE NOTICE '录入流程：';
    RAISE NOTICE '  1. 内部司机登录移动端';
    RAISE NOTICE '  2. 选择项目（从 internal_driver_project_routes 配置的项目）';
    RAISE NOTICE '  3. 选择装货地、卸货地（从常用地点）';
    RAISE NOTICE '  4. 填写装货数量';
    RAISE NOTICE '  5. 系统自动填充（从 internal_drivers 和 internal_vehicles）：';
    RAISE NOTICE '     - 司机姓名、车牌号、电话';
    RAISE NOTICE '     - 装货日期、卸货日期（今天）';
    RAISE NOTICE '  6. 插入 logistics_records 表';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 下一步：为测试司机配置项目线路';
    RAISE NOTICE '  示例：';
    RAISE NOTICE '  INSERT INTO internal_driver_project_routes (';
    RAISE NOTICE '    driver_id, project_id, is_primary_route, ';
    RAISE NOTICE '    common_loading_location_ids, common_unloading_location_ids';
    RAISE NOTICE '  ) VALUES (';
    RAISE NOTICE '    (SELECT id FROM internal_drivers WHERE name = ''王师傅''),';
    RAISE NOTICE '    ''项目UUID'',';
    RAISE NOTICE '    true,';
    RAISE NOTICE '    ARRAY[''装货地UUID1'', ''装货地UUID2''],';
    RAISE NOTICE '    ARRAY[''卸货地UUID1'', ''卸货地UUID2'']';
    RAISE NOTICE '  );';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

