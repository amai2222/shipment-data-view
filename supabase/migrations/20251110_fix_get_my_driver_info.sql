-- ============================================================================
-- 修复get_my_driver_info函数，添加fleet_manager_id字段
-- 创建时间：2025-11-10
-- 问题：函数缺少fleet_manager_id字段，导致前端无法获取车队长ID
-- ============================================================================

-- 先删除旧函数
DROP FUNCTION IF EXISTS get_my_driver_info() CASCADE;

-- 重新创建函数，添加fleet_manager_id字段
CREATE OR REPLACE FUNCTION get_my_driver_info()
RETURNS TABLE (
    id UUID,                    -- 司机ID（统一使用id，而不是driver_id）
    driver_id UUID,             -- 兼容字段（与id相同）
    name TEXT,
    phone TEXT,
    hire_date DATE,
    employment_status TEXT,
    base_salary NUMERIC,
    salary_calculation_type TEXT,
    commission_rate NUMERIC,
    bank_account TEXT,
    bank_name TEXT,
    fleet_manager_id UUID       -- 新增：车队长ID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        d.id,                    -- 作为id返回
        d.id as driver_id,       -- 兼容字段
        d.name,
        d.phone,
        d.hire_date,
        d.employment_status,
        d.base_salary,
        d.salary_calculation_type,
        d.commission_rate,
        d.bank_account,
        d.bank_name,
        d.fleet_manager_id       -- 新增：车队长ID
    FROM internal_drivers d
    WHERE d.id = v_driver_id;
END;
$$;

COMMENT ON FUNCTION get_my_driver_info IS '获取我的司机档案信息（司机专用），包含车队长ID';

