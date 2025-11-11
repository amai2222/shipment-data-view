-- ============================================================================
-- 创建车队长添加线路函数
-- 创建时间：2025-01-17
-- 功能：车队长添加线路（装货地和卸货地），自动添加到地点库、关联项目、设为常用线路
-- ============================================================================

CREATE OR REPLACE FUNCTION fleet_manager_add_route(
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
    v_fleet_manager_id UUID;
    v_route_name TEXT;
    v_existing_loading_location_id UUID;
    v_existing_unloading_location_id UUID;
BEGIN
    -- 1. 获取当前车队长ID
    v_fleet_manager_id := auth.uid();
    
    -- 检查用户是否是车队长
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = v_fleet_manager_id 
        AND role = 'fleet_manager'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', '只有车队长可以添加线路');
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
        VALUES (p_loading_location_name, v_fleet_manager_id)
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
        VALUES (p_unloading_location_name, v_fleet_manager_id)
        RETURNING id INTO v_unloading_location_id;
    END IF;

    -- 4. 关联装货地到项目（如果项目ID不为空）
    IF p_project_id IS NOT NULL THEN
        INSERT INTO location_projects (location_id, project_id)
        VALUES (v_loading_location_id, p_project_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 5. 关联卸货地到项目（如果项目ID不为空）
    IF p_project_id IS NOT NULL THEN
        INSERT INTO location_projects (location_id, project_id)
        VALUES (v_unloading_location_id, p_project_id)
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

COMMENT ON FUNCTION fleet_manager_add_route IS '车队长添加线路（装货地和卸货地），自动添加到地点库、关联项目、设为常用线路';

GRANT EXECUTE ON FUNCTION fleet_manager_add_route TO authenticated;
GRANT EXECUTE ON FUNCTION fleet_manager_add_route TO anon;

