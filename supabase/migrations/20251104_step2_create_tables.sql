-- ============================================================================
-- 步骤2：创建内部司机和车辆管理系统表结构
-- ============================================================================
-- 功能：管理公司自有司机和车辆（区别于外部合作方司机）
-- 关系：复用 logistics_records 表，通过 driver_name 和 license_plate 关联
-- 照片存储：七牛云（JSONB 数组存储 URL）
-- 前置条件：必须先执行 20251104_step1_add_roles.sql
-- 创建时间：2025-11-04
-- ============================================================================

BEGIN;

-- ==========================================
-- 准备工作：清理可能存在的旧表（避免字段不匹配）
-- ==========================================

DROP TABLE IF EXISTS public.internal_driver_vehicle_relations CASCADE;
DROP TABLE IF EXISTS public.internal_vehicles CASCADE;
DROP TABLE IF EXISTS public.internal_drivers CASCADE;

DROP FUNCTION IF EXISTS get_internal_drivers CASCADE;
DROP FUNCTION IF EXISTS get_driver_vehicles CASCADE;
DROP FUNCTION IF EXISTS get_vehicle_drivers CASCADE;

-- ==========================================
-- 第一步：创建内部司机表
-- ==========================================

CREATE TABLE public.internal_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========== 基本信息 ==========
    name TEXT NOT NULL,                      -- 司机姓名
    phone TEXT NOT NULL,                     -- 联系电话
    id_card_number TEXT,                     -- 身份证号
    
    -- ========== 入职信息 ==========
    hire_date DATE,                          -- 入职日期
    employment_status TEXT DEFAULT 'active', -- 在职状态：active-在职, on_leave-请假, resigned-离职
    
    -- ========== 证件照片（只保留司机个人证件）==========
    id_card_photos JSONB DEFAULT '[]'::jsonb,                    -- 身份证照片
    driver_license_photos JSONB DEFAULT '[]'::jsonb,             -- 驾驶证照片
    qualification_certificate_photos JSONB DEFAULT '[]'::jsonb,  -- 从业资格证照片
    
    -- ========== 证件有效期 ==========
    id_card_expire_date DATE,                      -- 身份证到期日
    driver_license_expire_date DATE,               -- 驾驶证到期日
    qualification_certificate_expire_date DATE,    -- 从业资格证到期日
    
    -- ========== 工资信息 ==========
    base_salary NUMERIC(10,2) DEFAULT 0,           -- 基本工资
    salary_calculation_type TEXT DEFAULT 'monthly', -- 工资计算方式：monthly-月薪, trip_based-按车次, commission-提成制
    commission_rate NUMERIC(5,2),                  -- 提成比例（百分比，如 10.5 表示 10.5%）
    
    -- ========== 银行信息 ==========
    bank_account TEXT,                             -- 银行账号
    bank_name TEXT,                                -- 开户行
    account_holder_name TEXT,                      -- 账户持有人姓名
    
    -- ========== 状态 ==========
    is_active BOOLEAN DEFAULT true,                -- 是否启用
    
    -- ========== 备注 ==========
    remarks TEXT,                                  -- 备注信息
    
    -- ========== 元数据 ==========
    user_id UUID,                                  -- 创建人
    created_at TIMESTAMPTZ DEFAULT NOW(),          -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),          -- 更新时间
    
    -- ========== 约束 ==========
    CONSTRAINT internal_drivers_phone_unique UNIQUE (phone),
    CONSTRAINT internal_drivers_id_card_unique UNIQUE (id_card_number)
);

-- ==========================================
-- 第二步：创建索引
-- ==========================================

CREATE INDEX idx_internal_drivers_name ON internal_drivers(name);
CREATE INDEX idx_internal_drivers_phone ON internal_drivers(phone);
CREATE INDEX idx_internal_drivers_employment_status ON internal_drivers(employment_status);
CREATE INDEX idx_internal_drivers_is_active ON internal_drivers(is_active);

-- ==========================================
-- 第三步：添加注释
-- ==========================================

COMMENT ON TABLE internal_drivers IS '内部司机表（公司自有司机，区别于外部合作司机）';

COMMENT ON COLUMN internal_drivers.name IS '司机姓名';
COMMENT ON COLUMN internal_drivers.phone IS '联系电话（唯一）';
COMMENT ON COLUMN internal_drivers.id_card_number IS '身份证号（唯一）';
COMMENT ON COLUMN internal_drivers.hire_date IS '入职日期';
COMMENT ON COLUMN internal_drivers.employment_status IS '在职状态：active-在职, on_leave-请假, resigned-离职';

COMMENT ON COLUMN internal_drivers.id_card_photos IS '身份证照片URL数组（JSONB格式）';
COMMENT ON COLUMN internal_drivers.driver_license_photos IS '驾驶证照片URL数组（JSONB格式）';
COMMENT ON COLUMN internal_drivers.qualification_certificate_photos IS '从业资格证照片URL数组（JSONB格式）';

COMMENT ON COLUMN internal_drivers.id_card_expire_date IS '身份证到期日';
COMMENT ON COLUMN internal_drivers.driver_license_expire_date IS '驾驶证到期日';
COMMENT ON COLUMN internal_drivers.qualification_certificate_expire_date IS '从业资格证到期日';

COMMENT ON COLUMN internal_drivers.base_salary IS '基本工资（元）';
COMMENT ON COLUMN internal_drivers.salary_calculation_type IS '工资计算方式：monthly-月薪, trip_based-按车次, commission-提成制';
COMMENT ON COLUMN internal_drivers.commission_rate IS '提成比例（百分比）';

COMMENT ON COLUMN internal_drivers.bank_account IS '银行账号';
COMMENT ON COLUMN internal_drivers.bank_name IS '开户行名称';
COMMENT ON COLUMN internal_drivers.account_holder_name IS '账户持有人姓名';

COMMENT ON COLUMN internal_drivers.is_active IS '是否启用';
COMMENT ON COLUMN internal_drivers.remarks IS '备注信息';

-- ==========================================
-- 第四步：启用 RLS
-- ==========================================

ALTER TABLE internal_drivers ENABLE ROW LEVEL SECURITY;

-- 策略1：所有认证用户可以查看
CREATE POLICY "internal_drivers_select_policy"
ON internal_drivers
FOR SELECT
TO authenticated
USING (true);

-- 策略2：管理员和车队长可以插入
CREATE POLICY "internal_drivers_insert_policy"
ON internal_drivers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'fleet_manager')
    )
);

-- 策略3：管理员和车队长可以更新
CREATE POLICY "internal_drivers_update_policy"
ON internal_drivers
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'fleet_manager')
    )
);

-- 策略4：只有管理员可以删除
CREATE POLICY "internal_drivers_delete_policy"
ON internal_drivers
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- ==========================================
-- 第五步：创建辅助函数
-- ==========================================

-- 函数：获取内部司机列表（带分页和搜索）
CREATE OR REPLACE FUNCTION get_internal_drivers(
    p_search TEXT DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    id_card_number TEXT,
    hire_date DATE,
    employment_status TEXT,
    base_salary NUMERIC,
    salary_calculation_type TEXT,
    is_active BOOLEAN,
    id_card_expire_date DATE,
    driver_license_expire_date DATE,
    qualification_certificate_expire_date DATE,
    created_at TIMESTAMPTZ,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset INTEGER;
BEGIN
    v_offset := (p_page - 1) * p_page_size;
    
    RETURN QUERY
    WITH filtered_drivers AS (
        SELECT 
            d.*,
            COUNT(*) OVER() as total_count
        FROM internal_drivers d
        WHERE 
            (p_search IS NULL OR p_search = '' OR 
             d.name ILIKE '%' || p_search || '%' OR
             d.phone ILIKE '%' || p_search || '%')
        ORDER BY d.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT 
        fd.id,
        fd.name,
        fd.phone,
        fd.id_card_number,
        fd.hire_date,
        fd.employment_status,
        fd.base_salary,
        fd.salary_calculation_type,
        fd.is_active,
        fd.id_card_expire_date,
        fd.driver_license_expire_date,
        fd.qualification_certificate_expire_date,
        fd.created_at,
        fd.total_count
    FROM filtered_drivers fd;
END;
$$;

COMMENT ON FUNCTION get_internal_drivers IS '获取内部司机列表（支持分页和搜索）';

-- ==========================================
-- 第六步：初始化示例数据（可选）
-- ==========================================

-- 如果需要，可以添加示例司机
-- INSERT INTO internal_drivers (name, phone, hire_date, employment_status, base_salary)
-- VALUES 
--   ('张三', '13800138000', '2024-01-01', 'active', 5000.00),
--   ('李四', '13900139000', '2024-02-01', 'active', 5500.00);

-- ==========================================
-- 第七步：验证表创建
-- ==========================================

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_column_count INTEGER;
    v_policy_count INTEGER;
BEGIN
    -- 检查表是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'internal_drivers'
    ) INTO v_table_exists;
    
    -- 统计列数
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'internal_drivers';
    
    -- 统计 RLS 策略数
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'internal_drivers';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 内部司机表创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '表信息：';
    RAISE NOTICE '  - 表名: internal_drivers';
    RAISE NOTICE '  - 字段数: %', v_column_count;
    RAISE NOTICE '  - RLS策略数: %', v_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '主要字段：';
    RAISE NOTICE '  ✅ 基本信息: name, phone, id_card_number';
    RAISE NOTICE '  ✅ 入职信息: hire_date, employment_status';
    RAISE NOTICE '  ✅ 证件照片: id_card_photos, driver_license_photos, qualification_certificate_photos';
    RAISE NOTICE '  ✅ 证件到期: 3个到期日期字段';
    RAISE NOTICE '  ✅ 工资信息: base_salary, salary_calculation_type, commission_rate';
    RAISE NOTICE '  ✅ 银行信息: bank_account, bank_name';
    RAISE NOTICE '';
    RAISE NOTICE '关联逻辑：';
    RAISE NOTICE '  - 通过 driver_name 和 license_plate 关联 logistics_records';
    RAISE NOTICE '  - 未来可扩展独立的车辆表';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 第八步：创建内部车辆表
-- ==========================================

CREATE TABLE public.internal_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========== 车辆基本信息 ==========
    license_plate TEXT NOT NULL UNIQUE,      -- 车牌号（唯一）
    vehicle_number TEXT,                     -- 车辆编号（内部编号）
    vehicle_type TEXT,                       -- 车辆类型：厢式货车、平板车、冷藏车等
    vehicle_brand TEXT,                      -- 品牌：东风、解放、福田等
    vehicle_model TEXT,                      -- 型号
    vehicle_color TEXT,                      -- 车身颜色
    manufacture_year INTEGER,                -- 出厂年份
    
    -- ========== 车辆规格 ==========
    load_capacity NUMERIC(10,2),             -- 核定载重量（吨）
    vehicle_length NUMERIC(5,2),             -- 车长（米）
    vehicle_width NUMERIC(5,2),              -- 车宽（米）
    vehicle_height NUMERIC(5,2),             -- 车高（米）
    fuel_type TEXT DEFAULT 'diesel',         -- 燃料类型：diesel-柴油, gasoline-汽油, electric-电动, hybrid-混动
    
    -- ========== 车辆证件照片（七牛云存储）==========
    driving_license_photos JSONB DEFAULT '[]'::jsonb,      -- 行驶证照片（正副页）
    transport_license_photos JSONB DEFAULT '[]'::jsonb,    -- 道路运输证照片
    vehicle_photos JSONB DEFAULT '[]'::jsonb,              -- 车辆外观照片（多角度）
    
    -- ========== 证件信息 ==========
    vin TEXT,                                -- 车架号（VIN码）
    engine_number TEXT,                      -- 发动机号
    driving_license_number TEXT,             -- 行驶证号
    transport_license_number TEXT,           -- 道路运输证号
    
    -- ========== 证件有效期 ==========
    driving_license_expire_date DATE,        -- 行驶证到期日
    transport_license_expire_date DATE,      -- 道路运输证到期日
    annual_inspection_date DATE,             -- 年检到期日
    
    -- ========== 保险信息 ==========
    insurance_company TEXT,                  -- 保险公司
    insurance_policy_number TEXT,            -- 保单号
    insurance_type TEXT,                     -- 险种：交强险、商业险等
    insurance_amount NUMERIC(12,2),          -- 保额
    insurance_start_date DATE,               -- 保险生效日
    insurance_expire_date DATE,              -- 保险到期日
    insurance_certificate_photos JSONB DEFAULT '[]'::jsonb, -- 保险单照片
    
    -- ========== 购车信息 ==========
    purchase_date DATE,                      -- 购车日期
    purchase_price NUMERIC(12,2),            -- 购车价格
    purchase_type TEXT DEFAULT 'purchase',   -- 购置方式：purchase-购买, lease-租赁, finance-分期
    
    -- ========== 维保信息 ==========
    last_maintenance_date DATE,              -- 上次保养日期
    next_maintenance_date DATE,              -- 下次保养日期
    maintenance_mileage INTEGER,             -- 保养里程
    current_mileage INTEGER,                 -- 当前里程
    
    -- ========== 状态信息 ==========
    vehicle_status TEXT DEFAULT 'active',    -- 车辆状态：active-正常, maintenance-维修中, retired-已报废
    is_active BOOLEAN DEFAULT true,          -- 是否启用
    
    -- ========== 备注 ==========
    remarks TEXT,                            -- 备注信息
    
    -- ========== 元数据 ==========
    user_id UUID,                            -- 创建人
    created_at TIMESTAMPTZ DEFAULT NOW(),    -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),    -- 更新时间
    
    -- ========== 约束 ==========
    CONSTRAINT internal_vehicles_license_plate_unique UNIQUE (license_plate),
    CONSTRAINT internal_vehicles_vin_unique UNIQUE (vin)
);

-- ==========================================
-- 第九步：创建车辆表索引
-- ==========================================

CREATE INDEX idx_internal_vehicles_license_plate ON internal_vehicles(license_plate);
CREATE INDEX idx_internal_vehicles_vehicle_status ON internal_vehicles(vehicle_status);
CREATE INDEX idx_internal_vehicles_is_active ON internal_vehicles(is_active);
CREATE INDEX idx_internal_vehicles_driving_license_expire ON internal_vehicles(driving_license_expire_date);
CREATE INDEX idx_internal_vehicles_insurance_expire ON internal_vehicles(insurance_expire_date);

-- ==========================================
-- 第十步：添加车辆表注释
-- ==========================================

COMMENT ON TABLE internal_vehicles IS '内部车辆表（公司自有车辆档案）';

COMMENT ON COLUMN internal_vehicles.license_plate IS '车牌号（唯一）';
COMMENT ON COLUMN internal_vehicles.vehicle_number IS '车辆内部编号';
COMMENT ON COLUMN internal_vehicles.vehicle_type IS '车辆类型：厢式货车、平板车、冷藏车等';
COMMENT ON COLUMN internal_vehicles.vin IS '车架号（VIN码，唯一）';

COMMENT ON COLUMN internal_vehicles.driving_license_photos IS '行驶证照片URL数组（JSONB格式，存储七牛云URL）';
COMMENT ON COLUMN internal_vehicles.transport_license_photos IS '道路运输证照片URL数组（JSONB格式，存储七牛云URL）';
COMMENT ON COLUMN internal_vehicles.vehicle_photos IS '车辆外观照片URL数组（JSONB格式，存储七牛云URL，支持多角度）';
COMMENT ON COLUMN internal_vehicles.insurance_certificate_photos IS '保险单照片URL数组（JSONB格式，存储七牛云URL）';

COMMENT ON COLUMN internal_vehicles.driving_license_expire_date IS '行驶证到期日（用于到期提醒）';
COMMENT ON COLUMN internal_vehicles.transport_license_expire_date IS '道路运输证到期日（用于到期提醒）';
COMMENT ON COLUMN internal_vehicles.annual_inspection_date IS '年检到期日（用于到期提醒）';
COMMENT ON COLUMN internal_vehicles.insurance_expire_date IS '保险到期日（用于到期提醒）';

COMMENT ON COLUMN internal_vehicles.vehicle_status IS '车辆状态：active-正常使用, maintenance-维修中, retired-已报废';

-- ==========================================
-- 第十一步：创建司机-车辆关联表
-- ==========================================

CREATE TABLE public.internal_driver_vehicle_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========== 关联关系 ==========
    driver_id UUID NOT NULL REFERENCES internal_drivers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES internal_vehicles(id) ON DELETE CASCADE,
    
    -- ========== 关系属性 ==========
    is_primary BOOLEAN DEFAULT false,        -- 是否为该车的主驾驶
    relation_type TEXT DEFAULT 'regular',    -- 关系类型：regular-固定, backup-备用, temporary-临时
    
    -- ========== 有效期 ==========
    valid_from DATE,                         -- 关联生效日期
    valid_until DATE,                        -- 关联失效日期（NULL 表示长期有效）
    
    -- ========== 元数据 ==========
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- ========== 约束 ==========
    CONSTRAINT internal_driver_vehicle_unique UNIQUE (driver_id, vehicle_id)
);

-- 创建索引
CREATE INDEX idx_internal_driver_vehicle_driver ON internal_driver_vehicle_relations(driver_id);
CREATE INDEX idx_internal_driver_vehicle_vehicle ON internal_driver_vehicle_relations(vehicle_id);
CREATE INDEX idx_internal_driver_vehicle_is_primary ON internal_driver_vehicle_relations(is_primary);

-- 添加注释
COMMENT ON TABLE internal_driver_vehicle_relations IS '内部司机-车辆关联表（支持一司机多车）';
COMMENT ON COLUMN internal_driver_vehicle_relations.is_primary IS '是否为该车的主驾驶（每辆车只能有一个主驾驶）';
COMMENT ON COLUMN internal_driver_vehicle_relations.relation_type IS '关系类型：regular-固定, backup-备用, temporary-临时';

-- ==========================================
-- 第十二步：启用车辆表 RLS
-- ==========================================

ALTER TABLE internal_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_driver_vehicle_relations ENABLE ROW LEVEL SECURITY;

-- 车辆表 RLS 策略
CREATE POLICY "internal_vehicles_select_policy"
ON internal_vehicles FOR SELECT TO authenticated USING (true);

CREATE POLICY "internal_vehicles_insert_policy"
ON internal_vehicles FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

CREATE POLICY "internal_vehicles_update_policy"
ON internal_vehicles FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

CREATE POLICY "internal_vehicles_delete_policy"
ON internal_vehicles FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 关联表 RLS 策略
CREATE POLICY "internal_driver_vehicle_select_policy"
ON internal_driver_vehicle_relations FOR SELECT TO authenticated USING (true);

CREATE POLICY "internal_driver_vehicle_manage_policy"
ON internal_driver_vehicle_relations FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

-- ==========================================
-- 第十三步：创建辅助函数
-- ==========================================

-- 函数：获取司机的所有车辆
CREATE OR REPLACE FUNCTION get_driver_vehicles(p_driver_id UUID)
RETURNS TABLE (
    vehicle_id UUID,
    license_plate TEXT,
    vehicle_type TEXT,
    is_primary BOOLEAN,
    relation_type TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        v.id as vehicle_id,
        v.license_plate,
        v.vehicle_type,
        dvr.is_primary,
        dvr.relation_type
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = p_driver_id
    ORDER BY dvr.is_primary DESC, v.license_plate;
$$;

COMMENT ON FUNCTION get_driver_vehicles IS '获取指定司机的所有关联车辆';

-- 函数：获取车辆的所有司机
CREATE OR REPLACE FUNCTION get_vehicle_drivers(p_vehicle_id UUID)
RETURNS TABLE (
    driver_id UUID,
    driver_name TEXT,
    phone TEXT,
    is_primary BOOLEAN,
    relation_type TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.phone,
        dvr.is_primary,
        dvr.relation_type
    FROM internal_drivers d
    INNER JOIN internal_driver_vehicle_relations dvr ON d.id = dvr.driver_id
    WHERE dvr.vehicle_id = p_vehicle_id
    ORDER BY dvr.is_primary DESC, d.name;
$$;

COMMENT ON FUNCTION get_vehicle_drivers IS '获取指定车辆的所有关联司机';

COMMIT;

