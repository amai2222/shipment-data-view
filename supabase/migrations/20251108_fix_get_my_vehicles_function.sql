-- ============================================================================
-- 修复get_my_vehicles函数（使用正确的字段）
-- 创建日期：2025-11-08
-- 问题：函数使用了不存在的is_primary和relation_type字段
-- 解决：重写函数，使用valid_until判断当前有效的分配
-- ============================================================================

-- 同时修复get_current_driver_id函数（删除is_active字段）
-- 不删除函数，直接替换定义（避免破坏依赖的RLS策略）

CREATE OR REPLACE FUNCTION get_current_driver_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_user_full_name TEXT;
BEGIN
    -- 1. 通过user_id关联查找
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    IF v_driver_id IS NOT NULL THEN
        RETURN v_driver_id;
    END IF;
    
    -- 2. 如果没有关联，通过姓名匹配（兼容模式）
    SELECT full_name INTO v_user_full_name
    FROM profiles
    WHERE id = auth.uid();
    
    IF v_user_full_name IS NOT NULL THEN
        SELECT id INTO v_driver_id
        FROM internal_drivers
        WHERE name = v_user_full_name
        AND employment_status = 'active'  -- ✅ 改用employment_status
        LIMIT 1;
    END IF;
    
    RETURN v_driver_id;
END;
$$;

COMMENT ON FUNCTION get_current_driver_id IS '获取当前登录用户对应的司机档案ID';

-- 修复get_my_vehicles函数
-- 必须先DROP（返回类型改变了），使用CASCADE删除依赖

DROP FUNCTION IF EXISTS get_my_vehicles() CASCADE;

CREATE OR REPLACE FUNCTION get_my_vehicles()
RETURNS TABLE (
    vehicle_id UUID,
    license_plate TEXT,
    vehicle_type TEXT,
    vehicle_brand TEXT,
    vehicle_model TEXT,
    is_primary BOOLEAN,
    relation_type TEXT,
    assigned_at TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_name TEXT;
BEGIN
    -- 方式1：通过user_id关联查找司机ID
    SELECT id, name INTO v_driver_id, v_driver_name
    FROM internal_drivers
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    -- 方式2：如果没有关联，通过姓名匹配（兼容模式）
    IF v_driver_id IS NULL THEN
        SELECT full_name INTO v_driver_name
        FROM profiles
        WHERE id = auth.uid();
        
        IF v_driver_name IS NOT NULL THEN
            SELECT id INTO v_driver_id
            FROM internal_drivers
            WHERE name = v_driver_name
            AND employment_status = 'active'
            LIMIT 1;
        END IF;
    END IF;
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案，请联系管理员';
    END IF;
    
    -- 返回当前有效的车辆分配（只返回valid_until为NULL的）
    RETURN QUERY
    SELECT 
        v.id as vehicle_id,
        v.license_plate,
        v.vehicle_type,
        v.vehicle_brand,
        v.vehicle_model,
        true as is_primary,  -- 简化：所有车辆都标记为主要车辆
        'assigned' as relation_type,
        dvr.valid_from::TEXT as assigned_at
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND dvr.valid_until IS NULL  -- ✅ 只返回当前使用中的分配（结束日期为空）
    ORDER BY dvr.valid_from DESC;  -- 最新分配的在前
END;
$$;

COMMENT ON FUNCTION get_my_vehicles IS '获取我的车辆（司机专用，只返回当前有效分配的车辆）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_my_vehicles函数已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  ✓ get_current_driver_id: 删除is_active字段引用';
    RAISE NOTICE '  ✓ get_my_vehicles: 删除is_primary字段引用';
    RAISE NOTICE '  ✓ get_my_vehicles: 删除relation_type字段引用';
    RAISE NOTICE '  ✓ 使用valid_until判断当前有效分配';
    RAISE NOTICE '  ✓ 支持user_id关联和姓名匹配两种方式';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 注意：使用了CASCADE删除依赖视图/策略，会自动重建';
    RAISE NOTICE '';
    RAISE NOTICE '完整闭环：';
    RAISE NOTICE '  PC端分配车辆';
    RAISE NOTICE '    ↓ INSERT internal_driver_vehicle_relations';
    RAISE NOTICE '    ↓ valid_until = NULL（当前使用）';
    RAISE NOTICE '    ↓ 触发器同步到drivers表';
    RAISE NOTICE '  司机移动端';
    RAISE NOTICE '    ↓ 调用get_my_vehicles()';
    RAISE NOTICE '    ↓ 查询valid_until=NULL的分配';
    RAISE NOTICE '    ✅ 显示当前分配的车辆';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

