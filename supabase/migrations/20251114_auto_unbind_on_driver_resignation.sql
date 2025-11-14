-- ============================================================================
-- 自动解绑离职司机的车队长和车辆
-- 创建日期：2025-11-14
-- 功能：当司机状态变为离职时，自动解绑车队长和车辆关联
-- ============================================================================

-- ============================================================================
-- 第一步：创建触发器函数 - 司机离职时自动解绑
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_unbind_on_driver_resignation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 检查状态是否从非离职变为离职
    IF NEW.employment_status = 'resigned' AND 
       (OLD.employment_status IS NULL OR OLD.employment_status != 'resigned') THEN
        
        -- 1. 解绑车队长
        IF NEW.fleet_manager_id IS NOT NULL THEN
            NEW.fleet_manager_id := NULL;
            RAISE NOTICE '✅ 司机 % 已离职，自动解绑车队长', NEW.name;
        END IF;
        
        -- 2. 删除车辆关联（在 AFTER 触发器中执行，因为需要先更新司机记录）
        -- 注意：这里只标记，实际删除在 AFTER 触发器中执行
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_unbind_on_driver_resignation IS '触发器函数：司机离职时自动解绑车队长和车辆';

-- ============================================================================
-- 第二步：创建 AFTER 触发器函数 - 删除车辆关联并同步 drivers 表
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_delete_vehicle_relations_on_resignation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 检查状态是否从非离职变为离职
    IF NEW.employment_status = 'resigned' AND 
       (OLD.employment_status IS NULL OR OLD.employment_status != 'resigned') THEN
        
        -- 1. 删除该司机的所有车辆关联
        DELETE FROM internal_driver_vehicle_relations
        WHERE driver_id = NEW.id;
        
        -- 2. 同步更新 drivers 表的 fleet_manager_id（如果存在同步记录）
        UPDATE drivers
        SET fleet_manager_id = NULL,
            license_plate = NULL,  -- 同时清空车牌号
            updated_at = NOW()
        WHERE name = NEW.name
        AND phone = NEW.phone
        AND driver_type = 'internal';
        
        RAISE NOTICE '✅ 司机 % 已离职，已删除所有车辆关联并同步 drivers 表', NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_delete_vehicle_relations_on_resignation IS '触发器函数：司机离职后删除车辆关联并同步 drivers 表';

-- ============================================================================
-- 第三步：创建触发器
-- ============================================================================

-- BEFORE 触发器：在更新前解绑车队长
DROP TRIGGER IF EXISTS trigger_auto_unbind_on_resignation ON internal_drivers;

CREATE TRIGGER trigger_auto_unbind_on_resignation
    BEFORE UPDATE ON internal_drivers
    FOR EACH ROW
    WHEN (NEW.employment_status = 'resigned' AND 
          (OLD.employment_status IS NULL OR OLD.employment_status != 'resigned'))
    EXECUTE FUNCTION auto_unbind_on_driver_resignation();

COMMENT ON TRIGGER trigger_auto_unbind_on_resignation ON internal_drivers IS '司机离职时自动解绑车队长';

-- AFTER 触发器：在更新后删除车辆关联
DROP TRIGGER IF EXISTS trigger_auto_delete_vehicle_relations_on_resignation ON internal_drivers;

CREATE TRIGGER trigger_auto_delete_vehicle_relations_on_resignation
    AFTER UPDATE ON internal_drivers
    FOR EACH ROW
    WHEN (NEW.employment_status = 'resigned' AND 
          (OLD.employment_status IS NULL OR OLD.employment_status != 'resigned'))
    EXECUTE FUNCTION auto_delete_vehicle_relations_on_resignation();

COMMENT ON TRIGGER trigger_auto_delete_vehicle_relations_on_resignation ON internal_drivers IS '司机离职后自动删除车辆关联';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 司机离职自动解绑触发器已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '功能说明：';
    RAISE NOTICE '  1. 当司机状态变为"离职"时，自动将 fleet_manager_id 设为 NULL';
    RAISE NOTICE '  2. 自动删除 internal_driver_vehicle_relations 表中的所有关联记录';
    RAISE NOTICE '';
    RAISE NOTICE '触发器：';
    RAISE NOTICE '  - trigger_auto_unbind_on_resignation (BEFORE UPDATE)';
    RAISE NOTICE '  - trigger_auto_delete_vehicle_relations_on_resignation (AFTER UPDATE)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

