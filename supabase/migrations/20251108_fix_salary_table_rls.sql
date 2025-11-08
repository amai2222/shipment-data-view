-- ============================================================================
-- 修复 internal_driver_monthly_salary 表的 RLS 策略
-- 创建时间: 2025-11-08
-- 问题: 406 Not Acceptable - 表可能没有正确的 RLS 策略
-- 解决方案: 添加 RLS 策略允许司机查看自己的工资记录
-- ============================================================================

-- 确保表启用了 RLS
ALTER TABLE internal_driver_monthly_salary ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "salary_select_policy" ON internal_driver_monthly_salary;
DROP POLICY IF EXISTS "driver_salary_select_policy" ON internal_driver_monthly_salary;

-- 策略1：司机只能查看自己的工资记录
CREATE POLICY "driver_salary_select_policy"
ON internal_driver_monthly_salary
FOR SELECT
TO authenticated
USING (
    -- 司机：通过 user_id 关联
    EXISTS (
        SELECT 1 
        FROM internal_drivers 
        WHERE internal_drivers.id = internal_driver_monthly_salary.driver_id
        AND internal_drivers.user_id = auth.uid()
    )
    OR
    -- 车队长：可以查看管理的司机的工资
    EXISTS (
        SELECT 1 
        FROM internal_drivers 
        WHERE internal_drivers.id = internal_driver_monthly_salary.driver_id
        AND internal_drivers.fleet_manager_id = auth.uid()
    )
    OR
    -- 管理员和财务：可以查看所有
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'finance')
    )
);

-- 策略2：只有管理员和财务可以插入/更新工资记录
CREATE POLICY "salary_insert_policy"
ON internal_driver_monthly_salary
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'finance', 'fleet_manager')
    )
);

CREATE POLICY "salary_update_policy"
ON internal_driver_monthly_salary
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'finance', 'fleet_manager')
    )
);

-- ============================================================================
-- 验证修复
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ internal_driver_monthly_salary 表 RLS 策略已配置';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '权限说明:';
    RAISE NOTICE '  - 司机: 只能查看自己的工资记录';
    RAISE NOTICE '  - 车队长: 可以查看和管理下属司机的工资';
    RAISE NOTICE '  - 财务/管理员: 可以查看和管理所有工资记录';
    RAISE NOTICE '';
    RAISE NOTICE '💡 现在司机可以正常查看工资记录了';
    RAISE NOTICE '========================================';
END $$;

