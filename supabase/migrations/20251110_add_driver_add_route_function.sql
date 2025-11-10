-- ============================================================================
-- 创建司机添加线路函数
-- 创建时间：2025-11-10
-- 功能：司机端添加线路（装货地和卸货地），自动添加到地点库、关联项目、设为常用线路
-- ============================================================================

CREATE OR REPLACE FUNCTION driver_add_route(
    p_loading_location_name TEXT,
    p_unloading_location_name TEXT,
    p_project_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_loading_location_id UUID;
    v_unloading_location_id UUID;
    v_driver_id UUID;
    v_fleet_manager_id UUID;
    v_route_name TEXT;
    v_existing_loading_location_id UUID;
    v_existing_unloading_location_id UUID;
BEGIN
    -- 1. 获取当前司机ID
    v_driver_id := get_current_driver_id();
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;

    -- 1.1 获取车队长的ID
    SELECT fleet_manager_id INTO v_fleet_manager_id
    FROM internal_drivers
    WHERE id = v_driver_id;
    
    IF v_fleet_manager_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的车队长信息');
    END IF;

    -- 2. 检查装货地是否已存在
    SELECT id INTO v_existing_loading_location_id
    FROM locations
    WHERE name = p_loading_location_name
    LIMIT 1;

    IF v_existing_loading_location_id IS NOT NULL THEN
        v_loading_location_id := v_existing_loading_location_id;
    ELSE
        -- 创建新装货地
        INSERT INTO locations (name, user_id)
        VALUES (p_loading_location_name, auth.uid())
        RETURNING id INTO v_loading_location_id;
    END IF;

    -- 3. 检查卸货地是否已存在
    SELECT id INTO v_existing_unloading_location_id
    FROM locations
    WHERE name = p_unloading_location_name
    LIMIT 1;

    IF v_existing_unloading_location_id IS NOT NULL THEN
        v_unloading_location_id := v_existing_unloading_location_id;
    ELSE
        -- 创建新卸货地
        INSERT INTO locations (name, user_id)
        VALUES (p_unloading_location_name, auth.uid())
        RETURNING id INTO v_unloading_location_id;
    END IF;

    -- 4. 关联装货地到项目（如果未关联）
    IF NOT EXISTS (
        SELECT 1 FROM location_projects
        WHERE location_id = v_loading_location_id
        AND project_id = p_project_id
    ) THEN
        INSERT INTO location_projects (location_id, project_id, user_id)
        VALUES (v_loading_location_id, p_project_id, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;

    -- 5. 关联卸货地到项目（如果未关联）
    IF NOT EXISTS (
        SELECT 1 FROM location_projects
        WHERE location_id = v_unloading_location_id
        AND project_id = p_project_id
    ) THEN
        INSERT INTO location_projects (location_id, project_id, user_id)
        VALUES (v_unloading_location_id, p_project_id, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;

    -- 6. 创建或更新常用线路
    v_route_name := p_loading_location_name || '→' || p_unloading_location_name;
    
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
        v_fleet_manager_id,
        v_route_name,
        p_project_id,
        v_loading_location_id,
        v_unloading_location_id,
        p_loading_location_name,
        p_unloading_location_name,
        1 -- 初始使用次数
    )
    ON CONFLICT ON CONSTRAINT unique_route_per_manager DO UPDATE SET
        project_id = EXCLUDED.project_id,
        loading_location_id = EXCLUDED.loading_location_id,
        unloading_location_id = EXCLUDED.unloading_location_id,
        loading_location = EXCLUDED.loading_location,
        unloading_location = EXCLUDED.unloading_location,
        updated_at = NOW();

    -- 7. 将新创建/更新的线路分配给当前司机
    INSERT INTO fleet_manager_favorite_route_drivers (
        route_id,
        driver_id,
        fleet_manager_id
    )
    SELECT 
        id,
        v_driver_id,
        v_fleet_manager_id
    FROM fleet_manager_favorite_routes
    WHERE fleet_manager_id = v_fleet_manager_id
      AND route_name = v_route_name
    ON CONFLICT ON CONSTRAINT unique_route_driver DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'message', '线路添加成功',
        'loading_location_id', v_loading_location_id,
        'unloading_location_id', v_unloading_location_id,
        'route_name', v_route_name
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', '添加线路失败：' || SQLERRM);
END;
$$;

COMMENT ON FUNCTION driver_add_route IS '司机添加线路（装货地和卸货地），自动添加到地点库、关联项目、设为常用线路';

GRANT EXECUTE ON FUNCTION driver_add_route TO authenticated;
GRANT EXECUTE ON FUNCTION driver_add_route TO anon;

