-- ============================================================================
-- 添加费用冲销功能
-- 创建时间: 2025-11-09
-- 功能: 司机可以对已审核通过的费用申请进行冲销，输入实际消费金额，计算结余
-- ============================================================================

-- 添加费用冲销相关字段到费用申请表
DO $$
BEGIN
    -- 添加实际消费金额字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'internal_driver_expense_applications' 
        AND column_name = 'actual_amount'
    ) THEN
        ALTER TABLE internal_driver_expense_applications
        ADD COLUMN actual_amount NUMERIC(10,2);
        
        RAISE NOTICE '✅ 已添加 actual_amount 字段';
    ELSE
        RAISE NOTICE '⚠️  actual_amount 字段已存在';
    END IF;

    -- 添加冲销时间字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'internal_driver_expense_applications' 
        AND column_name = 'writeoff_time'
    ) THEN
        ALTER TABLE internal_driver_expense_applications
        ADD COLUMN writeoff_time TIMESTAMPTZ;
        
        RAISE NOTICE '✅ 已添加 writeoff_time 字段';
    ELSE
        RAISE NOTICE '⚠️  writeoff_time 字段已存在';
    END IF;
END $$;

COMMENT ON COLUMN internal_driver_expense_applications.actual_amount IS '实际消费金额（司机冲销时填写）';
COMMENT ON COLUMN internal_driver_expense_applications.writeoff_time IS '冲销时间';

-- ============================================================================
-- 创建费用冲销 RPC 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION writeoff_expense_application(
    p_application_id UUID,
    p_actual_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_driver_id UUID;
    v_application_exists BOOLEAN;
    v_application_status TEXT;
    v_approved_amount NUMERIC;
    v_balance NUMERIC;
BEGIN
    -- 获取当前用户
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '用户未登录'
        );
    END IF;
    
    -- 查找当前用户关联的司机档案
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE user_id = v_user_id
    LIMIT 1;
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '未找到关联的司机档案'
        );
    END IF;
    
    -- 检查申请是否存在且属于当前司机且已审核通过
    SELECT EXISTS(
        SELECT 1 
        FROM internal_driver_expense_applications 
        WHERE id = p_application_id 
        AND driver_id = v_driver_id
        AND status = 'approved'
    ) INTO v_application_exists;
    
    IF NOT v_application_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '申请不存在、无权操作或未审核通过'
        );
    END IF;
    
    -- 获取申请金额
    SELECT amount INTO v_approved_amount
    FROM internal_driver_expense_applications
    WHERE id = p_application_id;
    
    -- 验证实际金额
    IF p_actual_amount IS NULL OR p_actual_amount < 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '实际消费金额必须大于等于0'
        );
    END IF;
    
    -- 更新费用申请（记录实际消费金额和冲销时间）
    UPDATE internal_driver_expense_applications
    SET 
        actual_amount = p_actual_amount,
        writeoff_time = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;
    
    -- 计算结余（申请金额 - 实际金额）
    -- 正数表示结余，负数表示待补报销
    v_balance := v_approved_amount - p_actual_amount;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '费用冲销成功',
        'approved_amount', v_approved_amount,
        'actual_amount', p_actual_amount,
        'balance', v_balance
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '费用冲销失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION writeoff_expense_application IS '费用冲销（司机输入实际消费金额）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION writeoff_expense_application TO authenticated;

-- ============================================================================
-- 创建获取司机费用余额的 RPC 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_driver_expense_balance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_driver_id UUID;
    v_total_balance NUMERIC := 0;
BEGIN
    -- 获取当前用户
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '用户未登录'
        );
    END IF;
    
    -- 查找当前用户关联的司机档案
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE user_id = v_user_id
    LIMIT 1;
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '未找到关联的司机档案'
        );
    END IF;
    
    -- 计算总余额：所有已审核通过的费用申请的结余之和
    -- 结余 = 申请金额 - 实际金额（如果已冲销）
    SELECT COALESCE(SUM(
        amount - COALESCE(actual_amount, amount)
    ), 0) INTO v_total_balance
    FROM internal_driver_expense_applications
    WHERE driver_id = v_driver_id
    AND status = 'approved';
    
    RETURN jsonb_build_object(
        'success', true,
        'balance', v_total_balance
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '获取余额失败: ' || SQLERRM,
        'balance', 0
    );
END;
$$;

COMMENT ON FUNCTION get_driver_expense_balance IS '获取司机费用余额（正数=结余，负数=待补报销）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_driver_expense_balance TO authenticated;

