-- ============================================================================
-- 创建按车队长查询司机余额的 RPC 函数
-- 创建时间: 2025-11-09
-- 功能: 按车队长分组查询司机余额
-- ============================================================================

CREATE OR REPLACE FUNCTION get_driver_balances_by_fleet_manager()
RETURNS TABLE (
    fleet_manager_id UUID,
    fleet_manager_name TEXT,
    driver_id UUID,
    driver_name TEXT,
    balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_record RECORD;
    v_balance NUMERIC;
BEGIN
    -- 遍历所有活跃司机
    FOR v_driver_record IN 
        SELECT 
            d.id,
            d.name,
            d.fleet_manager_id,
            COALESCE(p.full_name, '未分配') as fleet_manager_name
        FROM internal_drivers d
        LEFT JOIN profiles p ON d.fleet_manager_id = p.id
        WHERE d.is_active = true
        ORDER BY 
            COALESCE(p.full_name, '未分配'),
            d.name
    LOOP
        -- 计算该司机的费用余额
        -- 结余 = 申请金额 - 实际金额（如果已冲销，否则为0）
        SELECT COALESCE(SUM(
            amount - COALESCE(actual_amount, amount)
        ), 0) INTO v_balance
        FROM internal_driver_expense_applications
        WHERE driver_id = v_driver_record.id
        AND status = 'approved';
        
        -- 返回该司机的记录
        RETURN QUERY SELECT 
            COALESCE(v_driver_record.fleet_manager_id, '00000000-0000-0000-0000-000000000000'::UUID),
            v_driver_record.fleet_manager_name,
            v_driver_record.id,
            v_driver_record.name,
            v_balance;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION get_driver_balances_by_fleet_manager IS '按车队长分组查询司机余额';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_driver_balances_by_fleet_manager TO authenticated;

