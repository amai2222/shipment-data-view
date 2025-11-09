-- ============================================================================
-- 添加线路分配给司机的功能
-- 创建时间：2025-11-10
-- 功能：车队长可以将常用线路分配给多个司机
-- ============================================================================

-- ============================================================================
-- 第一步：创建线路-司机分配表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fleet_manager_favorite_route_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联关系
    route_id UUID NOT NULL REFERENCES fleet_manager_favorite_routes(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES internal_drivers(id) ON DELETE CASCADE,
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 唯一约束：同一线路不能重复分配给同一司机
    CONSTRAINT unique_route_driver UNIQUE (route_id, driver_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_route_drivers_route ON fleet_manager_favorite_route_drivers(route_id);
CREATE INDEX IF NOT EXISTS idx_route_drivers_driver ON fleet_manager_favorite_route_drivers(driver_id);

-- 添加注释
COMMENT ON TABLE fleet_manager_favorite_route_drivers IS '车队长常用线路-司机分配表';
COMMENT ON COLUMN fleet_manager_favorite_route_drivers.route_id IS '常用线路ID（关联fleet_manager_favorite_routes表）';
COMMENT ON COLUMN fleet_manager_favorite_route_drivers.driver_id IS '司机ID（关联internal_drivers表）';

-- ============================================================================
-- 第二步：启用RLS
-- ============================================================================

ALTER TABLE fleet_manager_favorite_route_drivers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 第三步：创建RLS策略
-- ============================================================================

-- 先删除可能存在的旧策略
DROP POLICY IF EXISTS "route_drivers_select_policy" ON fleet_manager_favorite_route_drivers;
DROP POLICY IF EXISTS "route_drivers_insert_policy" ON fleet_manager_favorite_route_drivers;
DROP POLICY IF EXISTS "route_drivers_update_policy" ON fleet_manager_favorite_route_drivers;
DROP POLICY IF EXISTS "route_drivers_delete_policy" ON fleet_manager_favorite_route_drivers;

-- 查看策略：管理员可以查看所有，车队长只能查看自己线路的分配，司机只能查看分配给自己的线路
CREATE POLICY "route_drivers_select_policy"
ON fleet_manager_favorite_route_drivers
FOR SELECT
TO authenticated
USING (
    -- 管理员可以查看所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能查看自己线路的分配
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND EXISTS (
            SELECT 1 FROM fleet_manager_favorite_routes
            WHERE fleet_manager_favorite_routes.id = fleet_manager_favorite_route_drivers.route_id
            AND fleet_manager_favorite_routes.fleet_manager_id = auth.uid()
        )
    )
    OR
    -- 司机只能查看分配给自己的线路
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND EXISTS (
            SELECT 1 FROM internal_drivers
            WHERE internal_drivers.id = fleet_manager_favorite_route_drivers.driver_id
            AND internal_drivers.user_id = auth.uid()
        )
    )
);

-- 插入策略：管理员可以为任何线路分配，车队长只能为自己的线路分配
CREATE POLICY "route_drivers_insert_policy"
ON fleet_manager_favorite_route_drivers
FOR INSERT
TO authenticated
WITH CHECK (
    -- 管理员可以为任何线路分配
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能为自己的线路分配
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND EXISTS (
            SELECT 1 FROM fleet_manager_favorite_routes
            WHERE fleet_manager_favorite_routes.id = fleet_manager_favorite_route_drivers.route_id
            AND fleet_manager_favorite_routes.fleet_manager_id = auth.uid()
        )
    )
);

-- 删除策略：管理员可以删除所有，车队长只能删除自己线路的分配
CREATE POLICY "route_drivers_delete_policy"
ON fleet_manager_favorite_route_drivers
FOR DELETE
TO authenticated
USING (
    -- 管理员可以删除所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能删除自己线路的分配
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND EXISTS (
            SELECT 1 FROM fleet_manager_favorite_routes
            WHERE fleet_manager_favorite_routes.id = fleet_manager_favorite_route_drivers.route_id
            AND fleet_manager_favorite_routes.fleet_manager_id = auth.uid()
        )
    )
);

-- ============================================================================
-- 第四步：创建RPC函数 - 批量分配线路给司机
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_route_to_drivers(
    p_route_id UUID,
    p_driver_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fleet_manager_id UUID;
    v_route_exists BOOLEAN;
    v_driver_id UUID;
    v_inserted_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    -- 检查权限
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有管理员或车队长可以分配线路'
        );
    END IF;

    -- 检查线路是否存在，并获取车队长ID
    SELECT fleet_manager_id INTO v_fleet_manager_id
    FROM fleet_manager_favorite_routes
    WHERE id = p_route_id;

    IF v_fleet_manager_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '线路不存在'
        );
    END IF;

    -- 检查权限：车队长只能分配自己的线路
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        IF v_fleet_manager_id != auth.uid() THEN
            RETURN json_build_object(
                'success', false,
                'message', '权限不足：只能分配自己的线路'
            );
        END IF;
    END IF;

    -- 先删除该线路的所有现有分配
    DELETE FROM fleet_manager_favorite_route_drivers
    WHERE route_id = p_route_id;

    -- 批量插入新的分配
    IF p_driver_ids IS NOT NULL AND array_length(p_driver_ids, 1) > 0 THEN
        FOREACH v_driver_id IN ARRAY p_driver_ids
        LOOP
            -- 检查司机是否存在
            IF EXISTS (SELECT 1 FROM internal_drivers WHERE id = v_driver_id) THEN
                BEGIN
                    INSERT INTO fleet_manager_favorite_route_drivers (route_id, driver_id)
                    VALUES (p_route_id, v_driver_id);
                    v_inserted_count := v_inserted_count + 1;
                EXCEPTION
                    WHEN unique_violation THEN
                        v_skipped_count := v_skipped_count + 1;
                END;
            ELSE
                v_skipped_count := v_skipped_count + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', format('成功分配线路给 %s 个司机，跳过 %s 个', v_inserted_count, v_skipped_count),
        'inserted_count', v_inserted_count,
        'skipped_count', v_skipped_count
    );
END;
$$;

COMMENT ON FUNCTION assign_route_to_drivers IS '批量分配线路给司机';

GRANT EXECUTE ON FUNCTION assign_route_to_drivers TO authenticated;

