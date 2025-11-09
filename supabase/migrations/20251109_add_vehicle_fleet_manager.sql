-- ============================================================================
-- 为车辆表添加车队长关联字段
-- 创建时间: 2025-11-09
-- 功能: 支持将车辆分配给车队长管理
-- ============================================================================

-- 为车辆表添加车队长关联字段
ALTER TABLE internal_vehicles 
ADD COLUMN IF NOT EXISTS fleet_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_internal_vehicles_fleet_manager_id 
ON internal_vehicles(fleet_manager_id);

-- 添加注释
COMMENT ON COLUMN internal_vehicles.fleet_manager_id IS '所属车队长ID（关联profiles表，实现车辆分配给车队长管理）';

-- 验证
DO $$
BEGIN
    RAISE NOTICE '✅ 车辆表已添加车队长关联字段';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成：';
    RAISE NOTICE '  ✓ 添加 fleet_manager_id 字段到 internal_vehicles 表';
    RAISE NOTICE '  ✓ 创建索引 idx_internal_vehicles_fleet_manager_id';
    RAISE NOTICE '  ✓ 添加字段注释';
    RAISE NOTICE '';
    RAISE NOTICE '现在可以在车辆分配管理页面中分配车辆给车队长了';
    RAISE NOTICE '========================================';
END $$;

