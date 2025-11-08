-- ============================================================================
-- 统一司机表方案（优化版）
-- 创建日期：2025-11-07
-- 方案：drivers表作为统一司机表，internal_drivers自动同步过去
-- ============================================================================

-- ============================================================================
-- 第一步：为drivers表添加driver_type字段并修改license_plate约束
-- ============================================================================

-- 1. 添加driver_type字段
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS driver_type TEXT DEFAULT 'external';

-- 2. 修改license_plate为可为空（内部司机可能暂时未分配车辆）
ALTER TABLE drivers
ALTER COLUMN license_plate DROP NOT NULL;

COMMENT ON COLUMN drivers.driver_type IS '司机类型：internal-内部车队, external-外部合作司机';

-- 添加约束
ALTER TABLE drivers
DROP CONSTRAINT IF EXISTS drivers_type_check;

ALTER TABLE drivers
ADD CONSTRAINT drivers_type_check 
CHECK (driver_type IN ('internal', 'external'));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_drivers_type 
ON drivers(driver_type);

-- ============================================================================
-- 第二步：创建触发器 - internal_drivers变化时自动同步到drivers
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_internal_driver_to_drivers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_license_plate TEXT;
BEGIN
    -- 获取该司机当前使用的车辆（最新的分配记录）
    SELECT vehicle.license_plate INTO v_license_plate
    FROM internal_driver_vehicle_relations rel
    JOIN internal_vehicles vehicle ON rel.vehicle_id = vehicle.id
    WHERE rel.driver_id = NEW.id
    AND (rel.valid_until IS NULL OR rel.valid_until > CURRENT_DATE)  -- 未结束的分配
    ORDER BY rel.valid_from DESC
    LIMIT 1;
    
    -- 检查drivers表中是否已存在该司机（按姓名和电话匹配）
    SELECT id INTO v_driver_id
    FROM drivers
    WHERE name = NEW.name
    AND phone = NEW.phone
    LIMIT 1;
    
    IF v_driver_id IS NOT NULL THEN
        -- ✅ 已存在，更新所有字段
        UPDATE drivers
        SET driver_type = 'internal',
            name = NEW.name,  -- ✅ 同步姓名
            phone = NEW.phone,  -- ✅ 同步电话
            license_plate = COALESCE(v_license_plate, license_plate),  -- 同步车牌
            updated_at = NOW()
        WHERE id = v_driver_id;
        
        RAISE NOTICE '✅ 已更新drivers表：% 设为内部司机（姓名、电话、车牌已同步）', NEW.name;
    ELSE
        -- ❌ 不存在，插入新记录
        INSERT INTO drivers (
            name,
            phone,
            license_plate,
            driver_type,
            created_at,
            updated_at
        ) VALUES (
            NEW.name,
            NEW.phone,
            v_license_plate,
            'internal',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ 已添加到drivers表：% (内部司机)', NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_internal_driver_to_drivers IS '触发器函数：internal_drivers变化时自动同步到drivers表';

-- 创建触发器（INSERT和UPDATE时都触发）
DROP TRIGGER IF EXISTS trigger_sync_internal_driver ON internal_drivers;

CREATE TRIGGER trigger_sync_internal_driver
    AFTER INSERT OR UPDATE ON internal_drivers  -- ✅ 任何修改都同步
    FOR EACH ROW
    EXECUTE FUNCTION sync_internal_driver_to_drivers();

COMMENT ON TRIGGER trigger_sync_internal_driver ON internal_drivers IS '同步内部司机到统一司机表';

-- ============================================================================
-- 第三步：车辆分配变化时更新drivers表的车牌
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_vehicle_assignment_to_drivers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_driver_name TEXT;
    v_driver_phone TEXT;
    v_license_plate TEXT;
BEGIN
    -- 只处理当前有效的分配（valid_until为空或未到期）
    IF NEW.valid_until IS NULL OR NEW.valid_until > CURRENT_DATE THEN
        -- 获取司机信息
        SELECT name, phone INTO v_driver_name, v_driver_phone
        FROM internal_drivers
        WHERE id = NEW.driver_id;
        
        -- 获取车牌
        SELECT license_plate INTO v_license_plate
        FROM internal_vehicles
        WHERE id = NEW.vehicle_id;
        
        -- 更新drivers表
        UPDATE drivers
        SET license_plate = v_license_plate,
            updated_at = NOW()
        WHERE name = v_driver_name
        AND phone = v_driver_phone
        AND driver_type = 'internal';
        
        RAISE NOTICE '✅ 已更新司机车牌：% → %', v_driver_name, v_license_plate;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 先删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_sync_vehicle_assignment ON internal_driver_vehicle_relations;

CREATE TRIGGER trigger_sync_vehicle_assignment
    AFTER INSERT OR UPDATE ON internal_driver_vehicle_relations
    FOR EACH ROW
    EXECUTE FUNCTION sync_vehicle_assignment_to_drivers();

-- ============================================================================
-- 第四步：删除内部司机时的处理（方案B：保留历史）
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_internal_driver_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 将drivers表中对应的记录标记为外部司机（保留历史数据）
    UPDATE drivers
    SET driver_type = 'external',
        updated_at = NOW()
    WHERE name = OLD.name
    AND phone = OLD.phone
    AND driver_type = 'internal';
    
    RAISE NOTICE '✅ 内部司机已删除，drivers表记录已改为外部类型，保留历史运单数据';
    
    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION handle_internal_driver_delete IS '触发器函数：删除内部司机时将drivers表标记为外部（保留历史）';

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_handle_internal_driver_delete ON internal_drivers;

CREATE TRIGGER trigger_handle_internal_driver_delete
    BEFORE DELETE ON internal_drivers
    FOR EACH ROW
    EXECUTE FUNCTION handle_internal_driver_delete();

COMMENT ON TRIGGER trigger_handle_internal_driver_delete ON internal_drivers IS '删除内部司机时保留drivers表记录（改为外部类型）';

-- ============================================================================
-- 第五步：初始化现有数据
-- ============================================================================

-- 将所有internal_drivers中的司机同步到drivers表
INSERT INTO drivers (name, phone, license_plate, driver_type, created_at, updated_at)
SELECT 
    id.name,
    id.phone,
    iv.license_plate,
    'internal',
    NOW(),
    NOW()
FROM internal_drivers id
LEFT JOIN internal_driver_vehicle_relations ivr 
    ON id.id = ivr.driver_id 
    AND (ivr.valid_until IS NULL OR ivr.valid_until > CURRENT_DATE)  -- 当前有效的分配
LEFT JOIN internal_vehicles iv 
    ON ivr.vehicle_id = iv.id
WHERE NOT EXISTS (
    -- 避免重复插入
    SELECT 1 FROM drivers d 
    WHERE d.name = id.name 
    AND d.phone = id.phone
)
ON CONFLICT DO NOTHING;

-- 更新已存在的司机为内部类型
UPDATE drivers d
SET driver_type = 'internal',
    license_plate = COALESCE(
        (SELECT iv.license_plate 
         FROM internal_driver_vehicle_relations ivr
         JOIN internal_vehicles iv ON ivr.vehicle_id = iv.id
         WHERE ivr.driver_id = id.id 
         AND (ivr.valid_until IS NULL OR ivr.valid_until > CURRENT_DATE)
         ORDER BY ivr.valid_from DESC
         LIMIT 1
        ),
        d.license_plate
    ),
    updated_at = NOW()
FROM internal_drivers id
WHERE d.name = id.name
AND d.phone = id.phone
AND (d.driver_type IS NULL OR d.driver_type = 'external');

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
DECLARE
    v_internal_count INTEGER;
    v_external_count INTEGER;
    v_total_count INTEGER;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE driver_type = 'internal'),
        COUNT(*) FILTER (WHERE driver_type = 'external'),
        COUNT(*)
    INTO v_internal_count, v_external_count, v_total_count
    FROM drivers;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 统一司机表方案已实施';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'drivers表统计：';
    RAISE NOTICE '  • 内部司机：% 人', v_internal_count;
    RAISE NOTICE '  • 外部司机：% 人', v_external_count;
    RAISE NOTICE '  • 总计：% 人', v_total_count;
    RAISE NOTICE '';
    RAISE NOTICE '数据流向：';
    RAISE NOTICE '  internal_drivers（详细档案）';
    RAISE NOTICE '    ↓ 触发器自动同步';
    RAISE NOTICE '  drivers（统一司机表）';
    RAISE NOTICE '    ↓ logistics_records.driver_id指向这里';
    RAISE NOTICE '  logistics_records（运单表）';
    RAISE NOTICE '';
    RAISE NOTICE '优点：';
    RAISE NOTICE '  ✓ drivers表是完整的司机列表';
    RAISE NOTICE '  ✓ 录单时只查drivers表';
    RAISE NOTICE '  ✓ internal_drivers是内部司机的扩展信息';
    RAISE NOTICE '  ✓ 自动同步，数据一致性高';
    RAISE NOTICE '  ✓ 删除内部司机时保留历史运单数据';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

