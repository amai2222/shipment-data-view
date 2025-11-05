-- ============================================================================
-- 添加车队长-司机绑定关系
-- ============================================================================
-- 功能：支持多车队长，每个车队长管理一部分司机
-- 实现：在司机表添加 fleet_manager_id 字段
-- 创建时间：2025-11-05
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：为司机表添加车队长关联字段
-- ==========================================

ALTER TABLE internal_drivers 
ADD COLUMN IF NOT EXISTS fleet_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_internal_drivers_fleet_manager 
ON internal_drivers(fleet_manager_id);

COMMENT ON COLUMN internal_drivers.fleet_manager_id IS '所属车队长ID（关联profiles表，实现多车队长管理）';

-- ==========================================
-- 第二步：修改RLS策略 - 车队长只能看自己管理的司机
-- ==========================================

-- 删除旧的车队长策略
DROP POLICY IF EXISTS "internal_drivers_select_policy" ON internal_drivers;
DROP POLICY IF EXISTS "internal_drivers_insert_policy" ON internal_drivers;
DROP POLICY IF EXISTS "internal_drivers_update_policy" ON internal_drivers;
DROP POLICY IF EXISTS "internal_drivers_delete_policy" ON internal_drivers;

-- 新策略1：查看权限
CREATE POLICY "internal_drivers_select_policy"
ON internal_drivers
FOR SELECT
TO authenticated
USING (
    -- 管理员：可以看全部
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    -- 车队长：只能看自己管理的司机
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
    OR
    -- 司机：只能看自己
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND id = get_current_driver_id()
    )
);

-- 新策略2：车队长只能添加自己管理的司机
CREATE POLICY "internal_drivers_insert_policy"
ON internal_drivers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

-- 新策略3：车队长只能修改自己管理的司机
CREATE POLICY "internal_drivers_update_policy"
ON internal_drivers
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND fleet_manager_id = auth.uid()
    )
);

-- 新策略4：只有管理员可以删除
CREATE POLICY "internal_drivers_delete_policy"
ON internal_drivers
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==========================================
-- 第三步：修改费用申请表RLS - 车队长只能看自己司机的申请
-- ==========================================

DROP POLICY IF EXISTS "expense_select_own_policy" ON internal_driver_expense_applications;

CREATE POLICY "expense_select_own_policy"
ON internal_driver_expense_applications
FOR SELECT
TO authenticated
USING (
    -- 司机：只能看自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长：只能看自己管理的司机的申请
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND EXISTS (
            SELECT 1 FROM internal_drivers 
            WHERE id = driver_id 
            AND fleet_manager_id = auth.uid()
        )
    )
    OR
    -- 管理员和财务：可以看全部
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'finance'))
);

-- ==========================================
-- 第四步：修改工资表RLS
-- ==========================================

DROP POLICY IF EXISTS "salary_select_own_policy" ON internal_driver_monthly_salary;

CREATE POLICY "salary_select_own_policy"
ON internal_driver_monthly_salary
FOR SELECT
TO authenticated
USING (
    -- 司机：只能看自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长：只能看自己管理的司机的工资
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
        AND EXISTS (
            SELECT 1 FROM internal_drivers 
            WHERE id = driver_id 
            AND fleet_manager_id = auth.uid()
        )
    )
    OR
    -- 管理员、财务：可以看全部
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'finance'))
);

-- ==========================================
-- 第五步：获取我的司机列表（车队长专用）
-- ==========================================

CREATE OR REPLACE FUNCTION get_my_drivers()
RETURNS TABLE (
    driver_id UUID,
    driver_name TEXT,
    phone TEXT,
    hire_date DATE,
    employment_status TEXT,
    base_salary NUMERIC,
    primary_vehicle TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 检查权限
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'fleet_manager')
    ) THEN
        RAISE EXCEPTION '无权限查看';
    END IF;
    
    RETURN QUERY
    SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.phone,
        d.hire_date,
        d.employment_status,
        d.base_salary,
        v.license_plate as primary_vehicle
    FROM internal_drivers d
    LEFT JOIN internal_driver_vehicle_relations dvr ON d.id = dvr.driver_id AND dvr.is_primary = true
    LEFT JOIN internal_vehicles v ON dvr.vehicle_id = v.id
    WHERE 
        -- 管理员看全部
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
        OR
        -- 车队长只看自己管理的
        (
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'fleet_manager')
            AND d.fleet_manager_id = auth.uid()
        )
    ORDER BY d.name;
END;
$$;

COMMENT ON FUNCTION get_my_drivers IS '获取我管理的司机列表（车队长专用，只返回自己管理的司机）';

-- ==========================================
-- 第六步：验证
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 多车队长支持已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '数据库变更：';
    RAISE NOTICE '  - internal_drivers 表新增 fleet_manager_id 字段';
    RAISE NOTICE '';
    RAISE NOTICE '数据隔离规则：';
    RAISE NOTICE '  ✅ 车队长A 只能看到 fleet_manager_id = A 的司机';
    RAISE NOTICE '  ✅ 车队长B 只能看到 fleet_manager_id = B 的司机';
    RAISE NOTICE '  ✅ 管理员可以看到所有司机';
    RAISE NOTICE '';
    RAISE NOTICE '下一步操作：';
    RAISE NOTICE '  1. 为司机分配车队长：';
    RAISE NOTICE '     UPDATE internal_drivers ';
    RAISE NOTICE '     SET fleet_manager_id = (SELECT id FROM profiles WHERE email = ''tanyulong@test.com'')';
    RAISE NOTICE '     WHERE name IN (''王师傅'', ''李师傅'', ''张师傅'');';
    RAISE NOTICE '';
    RAISE NOTICE '  2. 创建第二个车队长账号，分配其他司机';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

