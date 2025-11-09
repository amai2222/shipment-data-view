-- ============================================================================
-- 修复RLS策略无限递归问题
-- 创建时间：2025-11-10
-- 问题：fleet_manager_favorite_routes 和 fleet_manager_favorite_route_drivers 
--       两个表的RLS策略互相查询，导致无限递归
-- 解决：在分配表中添加冗余字段，避免跨表查询
-- ============================================================================

-- ============================================================================
-- 第一步：在分配表中添加冗余字段 fleet_manager_id
-- ============================================================================

-- 添加 fleet_manager_id 字段（如果不存在）
ALTER TABLE fleet_manager_favorite_route_drivers 
ADD COLUMN IF NOT EXISTS fleet_manager_id UUID;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_route_drivers_fleet_manager 
ON fleet_manager_favorite_route_drivers(fleet_manager_id);

-- 更新现有数据：从 fleet_manager_favorite_routes 表填充 fleet_manager_id
UPDATE fleet_manager_favorite_route_drivers rfd
SET fleet_manager_id = (
    SELECT fleet_manager_id 
    FROM fleet_manager_favorite_routes 
    WHERE id = rfd.route_id
)
WHERE fleet_manager_id IS NULL;

-- 创建触发器：自动维护 fleet_manager_id 字段
CREATE OR REPLACE FUNCTION sync_route_driver_fleet_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 当插入或更新时，自动从 route_id 获取 fleet_manager_id
    IF NEW.route_id IS NOT NULL THEN
        SELECT fleet_manager_id INTO NEW.fleet_manager_id
        FROM fleet_manager_favorite_routes
        WHERE id = NEW.route_id;
    END IF;
    RETURN NEW;
END;
$$;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_sync_route_driver_fleet_manager 
ON fleet_manager_favorite_route_drivers;

-- 创建触发器
CREATE TRIGGER trigger_sync_route_driver_fleet_manager
BEFORE INSERT OR UPDATE ON fleet_manager_favorite_route_drivers
FOR EACH ROW
EXECUTE FUNCTION sync_route_driver_fleet_manager();

-- ============================================================================
-- 第二步：修复 fleet_manager_favorite_routes 表的RLS策略
-- ============================================================================

-- 删除旧策略
DROP POLICY IF EXISTS "favorite_routes_select_policy" ON fleet_manager_favorite_routes;

-- 创建新策略：司机策略使用分配表的冗余字段，避免递归
CREATE POLICY "favorite_routes_select_policy"
ON fleet_manager_favorite_routes
FOR SELECT
TO authenticated
USING (
    -- 管理员可以查看所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能查看自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
    OR
    -- 司机只能查看分配给自己的线路（使用冗余字段，避免递归）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND EXISTS (
            SELECT 1 FROM fleet_manager_favorite_route_drivers
            INNER JOIN internal_drivers ON internal_drivers.id = fleet_manager_favorite_route_drivers.driver_id
            WHERE fleet_manager_favorite_route_drivers.route_id = fleet_manager_favorite_routes.id
            AND internal_drivers.user_id = auth.uid()
            -- 注意：这里查询分配表，但分配表的策略不会查询线路表，所以不会递归
        )
    )
);

-- ============================================================================
-- 第三步：修复 fleet_manager_favorite_route_drivers 表的RLS策略
-- ============================================================================

-- 删除旧策略
DROP POLICY IF EXISTS "route_drivers_select_policy" ON fleet_manager_favorite_route_drivers;
DROP POLICY IF EXISTS "route_drivers_insert_policy" ON fleet_manager_favorite_route_drivers;
DROP POLICY IF EXISTS "route_drivers_delete_policy" ON fleet_manager_favorite_route_drivers;

-- 创建查询策略：使用冗余字段，不查询 fleet_manager_favorite_routes 表
CREATE POLICY "route_drivers_select_policy"
ON fleet_manager_favorite_route_drivers
FOR SELECT
TO authenticated
USING (
    -- 管理员可以查看所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能查看自己线路的分配（使用冗余字段，不查询线路表）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
    OR
    -- 司机只能查看分配给自己的线路（不查询线路表，避免递归）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND EXISTS (
            SELECT 1 FROM internal_drivers
            WHERE internal_drivers.id = fleet_manager_favorite_route_drivers.driver_id
            AND internal_drivers.user_id = auth.uid()
        )
    )
);

-- 创建插入策略：使用冗余字段
CREATE POLICY "route_drivers_insert_policy"
ON fleet_manager_favorite_route_drivers
FOR INSERT
TO authenticated
WITH CHECK (
    -- 管理员可以为任何线路分配
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能为自己的线路分配（使用冗余字段检查）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
);

-- 创建删除策略：使用冗余字段
CREATE POLICY "route_drivers_delete_policy"
ON fleet_manager_favorite_route_drivers
FOR DELETE
TO authenticated
USING (
    -- 管理员可以删除所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能删除自己线路的分配（使用冗余字段检查）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
);

-- ============================================================================
-- 添加注释
-- ============================================================================

COMMENT ON COLUMN fleet_manager_favorite_route_drivers.fleet_manager_id IS '车队长ID（冗余字段，用于避免RLS策略递归）';
COMMENT ON POLICY "favorite_routes_select_policy" ON fleet_manager_favorite_routes IS '线路表查询策略：使用分配表的冗余字段避免递归';
COMMENT ON POLICY "route_drivers_select_policy" ON fleet_manager_favorite_route_drivers IS '分配表查询策略：使用冗余字段，不查询线路表，避免递归';
