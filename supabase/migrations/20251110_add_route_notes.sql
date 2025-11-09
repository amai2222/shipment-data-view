-- ============================================================================
-- 为常用线路表添加备注字段
-- ============================================================================

-- 添加备注字段
ALTER TABLE fleet_manager_favorite_routes 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 添加注释
COMMENT ON COLUMN fleet_manager_favorite_routes.notes IS '线路备注信息';

-- ============================================================================
-- 更新 save_favorite_route 函数以支持备注
-- ============================================================================

-- 先删除旧版本的函数（如果有多个重载版本）
DROP FUNCTION IF EXISTS save_favorite_route(TEXT, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS save_favorite_route(TEXT, UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS save_favorite_route(TEXT, UUID, UUID, UUID, TEXT, UUID);

-- 创建新版本的函数（支持备注和可选的车队长ID）
CREATE OR REPLACE FUNCTION save_favorite_route(
    p_route_name TEXT,
    p_project_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_fleet_manager_id UUID DEFAULT NULL  -- 可选：管理员可以为其他车队长配置
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_fleet_manager_id UUID;
    v_user_role TEXT;
BEGIN
    -- 权限检查
    SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
    
    IF v_user_role NOT IN ('admin', 'fleet_manager') THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足'
        );
    END IF;
    
    -- 确定使用的车队长ID
    IF v_user_role = 'admin' AND p_fleet_manager_id IS NOT NULL THEN
        -- 管理员可以为指定的车队长配置
        v_fleet_manager_id := p_fleet_manager_id;
    ELSE
        -- 车队长只能为自己配置，或管理员未指定时使用当前用户ID
        v_fleet_manager_id := auth.uid();
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
        use_count,
        notes
    ) VALUES (
        v_fleet_manager_id,
        p_route_name,
        p_project_id,
        p_loading_location_id,
        p_unloading_location_id,
        v_loading_location,
        v_unloading_location,
        1,
        p_notes
    )
    ON CONFLICT ON CONSTRAINT unique_route_per_manager
    DO UPDATE SET
        project_id = EXCLUDED.project_id,
        loading_location_id = EXCLUDED.loading_location_id,
        unloading_location_id = EXCLUDED.unloading_location_id,
        loading_location = EXCLUDED.loading_location,
        unloading_location = EXCLUDED.unloading_location,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', '线路已保存'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '保存失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION save_favorite_route IS '保存常用线路（车队长），支持备注';

-- ============================================================================
-- 更新 RLS 策略以允许管理员为其他车队长配置
-- ============================================================================

-- 删除所有旧的RLS策略（包括可能存在的所有版本）
DROP POLICY IF EXISTS "favorite_routes_policy" ON fleet_manager_favorite_routes;
DROP POLICY IF EXISTS "favorite_routes_select_policy" ON fleet_manager_favorite_routes;
DROP POLICY IF EXISTS "favorite_routes_insert_policy" ON fleet_manager_favorite_routes;
DROP POLICY IF EXISTS "favorite_routes_update_policy" ON fleet_manager_favorite_routes;
DROP POLICY IF EXISTS "favorite_routes_delete_policy" ON fleet_manager_favorite_routes;

-- 创建新的RLS策略：允许管理员查看所有，车队长只能查看自己的，司机只能查看分配给自己的
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
    -- 司机只能查看分配给自己的线路
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND EXISTS (
            SELECT 1 FROM fleet_manager_favorite_route_drivers
            INNER JOIN internal_drivers ON internal_drivers.id = fleet_manager_favorite_route_drivers.driver_id
            WHERE fleet_manager_favorite_route_drivers.route_id = fleet_manager_favorite_routes.id
            AND internal_drivers.user_id = auth.uid()
        )
    )
);

-- 创建插入策略：允许管理员为任何车队长插入，车队长只能为自己插入
CREATE POLICY "favorite_routes_insert_policy"
ON fleet_manager_favorite_routes
FOR INSERT
TO authenticated
WITH CHECK (
    -- 管理员可以为任何车队长插入
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能为自己插入
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
);

-- 创建更新策略：允许管理员更新所有，车队长只能更新自己的
CREATE POLICY "favorite_routes_update_policy"
ON fleet_manager_favorite_routes
FOR UPDATE
TO authenticated
USING (
    -- 管理员可以更新所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能更新自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
)
WITH CHECK (
    -- 管理员可以更新所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能更新自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
);

-- 创建删除策略：允许管理员删除所有，车队长只能删除自己的
CREATE POLICY "favorite_routes_delete_policy"
ON fleet_manager_favorite_routes
FOR DELETE
TO authenticated
USING (
    -- 管理员可以删除所有
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长只能删除自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
);

