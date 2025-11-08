-- ============================================================================
-- 修复车辆分配唯一约束问题
-- 创建日期：2025-11-08
-- 问题：唯一约束阻止同一司机-车辆组合的多次分配（包括历史记录）
-- 解决：改为部分唯一索引，只约束当前有效的分配
-- ============================================================================

-- ============================================================================
-- 第一步：删除旧的唯一约束
-- ============================================================================

ALTER TABLE internal_driver_vehicle_relations
DROP CONSTRAINT IF EXISTS internal_driver_vehicle_unique;

-- 删除可能存在的其他唯一约束
ALTER TABLE internal_driver_vehicle_relations
DROP CONSTRAINT IF EXISTS internal_driver_vehicle_relations_driver_id_vehicle_id_key;

ALTER TABLE internal_driver_vehicle_relations
DROP CONSTRAINT IF EXISTS internal_driver_vehicle_relations_unique;

-- ============================================================================
-- 第二步：创建部分唯一索引（只约束当前有效的分配）
-- ============================================================================

-- 创建部分唯一索引：同一个司机和车辆的组合，只能有一个valid_until为NULL的记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_driver_vehicle
ON internal_driver_vehicle_relations(driver_id, vehicle_id)
WHERE valid_until IS NULL;

COMMENT ON INDEX idx_unique_active_driver_vehicle IS '唯一索引：同一司机-车辆组合只能有一个当前有效的分配（valid_until为NULL）';

-- ============================================================================
-- 第三步：清理可能的重复数据
-- ============================================================================

-- 如果有多个valid_until=NULL的重复分配，只保留最新的
WITH duplicates AS (
    SELECT 
        driver_id,
        vehicle_id,
        id,
        valid_from,
        ROW_NUMBER() OVER (
            PARTITION BY driver_id, vehicle_id 
            ORDER BY valid_from DESC
        ) as rn
    FROM internal_driver_vehicle_relations
    WHERE valid_until IS NULL
)
UPDATE internal_driver_vehicle_relations
SET valid_until = CURRENT_DATE - INTERVAL '1 day'
FROM duplicates
WHERE internal_driver_vehicle_relations.id = duplicates.id
AND duplicates.rn > 1;  -- 设置结束日期给旧的重复记录

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 车辆分配唯一约束已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成：';
    RAISE NOTICE '  ✓ 删除旧的唯一约束';
    RAISE NOTICE '  ✓ 创建部分唯一索引（只约束当前有效分配）';
    RAISE NOTICE '  ✓ 清理重复数据';
    RAISE NOTICE '';
    RAISE NOTICE '效果：';
    RAISE NOTICE '  ✓ 允许同一司机-车辆有多次分配历史';
    RAISE NOTICE '  ✓ 但同一时刻只能有一个有效分配';
    RAISE NOTICE '  ✓ valid_until=NULL 表示当前使用中';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

