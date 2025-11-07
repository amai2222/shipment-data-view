-- ============================================================================
-- 创建完整的费用申请审核系统
-- 创建日期：2025-11-06
-- 功能：司机提交费用→车队长/PC端审核→完整闭环
-- ============================================================================

-- ============================================================================
-- 第一步：创建费用申请表（如果不存在）
-- ============================================================================

CREATE TABLE IF NOT EXISTS internal_driver_expense_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES internal_drivers(id),
    driver_name TEXT NOT NULL,
    expense_date DATE NOT NULL,
    expense_type TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    receipt_photos TEXT[],
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 表注释
COMMENT ON TABLE internal_driver_expense_applications IS '司机费用申请表';

-- 字段注释
COMMENT ON COLUMN internal_driver_expense_applications.id IS '主键ID';
COMMENT ON COLUMN internal_driver_expense_applications.driver_id IS '司机ID（关联internal_drivers表）';
COMMENT ON COLUMN internal_driver_expense_applications.driver_name IS '司机姓名（冗余字段，方便查询）';
COMMENT ON COLUMN internal_driver_expense_applications.expense_date IS '费用发生日期';
COMMENT ON COLUMN internal_driver_expense_applications.expense_type IS '费用类型：fuel-加油费, toll-过路费, maintenance-维修费, parking-停车费, fine-罚款, meal-餐费, accommodation-住宿费, other-其他';
COMMENT ON COLUMN internal_driver_expense_applications.amount IS '费用金额（元，保留2位小数）';
COMMENT ON COLUMN internal_driver_expense_applications.description IS '费用说明描述';
COMMENT ON COLUMN internal_driver_expense_applications.receipt_photos IS '收据照片URL数组';
COMMENT ON COLUMN internal_driver_expense_applications.status IS '申请状态：Pending-待审核, Approved-已通过, Rejected-已驳回';
COMMENT ON COLUMN internal_driver_expense_applications.notes IS '审核备注（审核时填写）';
COMMENT ON COLUMN internal_driver_expense_applications.reviewed_by IS '审核人ID（关联auth.users表）';
COMMENT ON COLUMN internal_driver_expense_applications.reviewed_at IS '审核时间';
COMMENT ON COLUMN internal_driver_expense_applications.created_at IS '申请创建时间';
COMMENT ON COLUMN internal_driver_expense_applications.updated_at IS '最后更新时间';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_expense_applications_driver 
ON internal_driver_expense_applications(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_expense_applications_status 
ON internal_driver_expense_applications(status, expense_date);

-- ============================================================================
-- 第二步：创建提交费用申请RPC函数
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_expense_application(
    p_expense_date DATE,
    p_expense_type TEXT,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL,
    p_receipt_photos TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_driver_id UUID;
    v_driver_name TEXT;
    v_application_id UUID;
BEGIN
    -- 获取当前用户
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '用户未登录'
        );
    END IF;
    
    -- 查找当前用户关联的司机档案
    SELECT id, name INTO v_driver_id, v_driver_name
    FROM internal_drivers
    WHERE user_id = v_user_id
    LIMIT 1;
    
    IF v_driver_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '未找到关联的司机档案，请联系管理员'
        );
    END IF;
    
    -- 插入费用申请
    INSERT INTO internal_driver_expense_applications (
        driver_id,
        driver_name,
        expense_date,
        expense_type,
        amount,
        description,
        receipt_photos,
        status
    ) VALUES (
        v_driver_id,
        v_driver_name,
        p_expense_date,
        p_expense_type,
        p_amount,
        p_description,
        p_receipt_photos,
        'Pending'
    )
    RETURNING id INTO v_application_id;
    
    RETURN json_build_object(
        'success', true,
        'message', '费用申请已提交',
        'application_id', v_application_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '提交失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION submit_expense_application IS '司机提交费用申请';

-- ============================================================================
-- 第三步：创建审核费用申请RPC函数
-- ============================================================================

CREATE OR REPLACE FUNCTION review_expense_application(
    p_application_id UUID,
    p_approved BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- 权限检查（车队长或管理员）
    IF NOT (public.is_admin() OR public.has_role('fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有车队长或管理员可以审核费用'
        );
    END IF;
    
    v_status := CASE WHEN p_approved THEN 'Approved' ELSE 'Rejected' END;
    
    -- 更新申请状态
    UPDATE internal_driver_expense_applications
    SET status = v_status,
        notes = p_notes,
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;
    
    RETURN json_build_object(
        'success', true,
        'message', CASE WHEN p_approved THEN '费用已批准' ELSE '费用已驳回' END
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '审核失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION review_expense_application IS '审核费用申请（车队长或管理员）';

-- ============================================================================
-- 第四步：创建辅助函数
-- ============================================================================

-- 检查是否有车队长角色
CREATE OR REPLACE FUNCTION has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    SELECT raw_user_meta_data->>'role' INTO v_user_role
    FROM auth.users
    WHERE id = auth.uid();
    
    RETURN v_user_role = p_role;
END;
$$;

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 费用申请审核系统已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已创建：';
    RAISE NOTICE '  ✓ internal_driver_expense_applications 表';
    RAISE NOTICE '  ✓ submit_expense_application() 函数';
    RAISE NOTICE '  ✓ review_expense_application() 函数';
    RAISE NOTICE '  ✓ has_role() 辅助函数';
    RAISE NOTICE '';
    RAISE NOTICE '完整流程：';
    RAISE NOTICE '  1. 司机移动端：提交费用申请';
    RAISE NOTICE '  2. PC端/车队长移动端：查看待审核列表';
    RAISE NOTICE '  3. 审核：批准或驳回';
    RAISE NOTICE '  4. 司机移动端：查看审核结果';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

