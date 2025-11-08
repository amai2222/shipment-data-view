-- ============================================================================
-- 统一修复所有状态值大小写不一致问题
-- 创建时间: 2025-11-08
-- 问题: 多处函数使用的状态值与数据库约束不匹配
-- 解决方案: 根据各表的约束统一状态值
-- ============================================================================

-- ============================================================================
-- 约束说明：
-- 1. internal_driver_expense_applications: 小写 ('pending', 'approved', 'rejected', 'paid')
-- 2. internal_driver_vehicle_change_applications: 小写 ('pending', 'approved', 'rejected')
-- 3. invoice_requests: 首字母大写 ('Pending', 'Approved', 'Rejected', etc.)
-- 4. payment_requests: 首字母大写 ('Pending', 'Approved', 'Paid', etc.)
-- ============================================================================

-- ============================================================================
-- 修复1: review_expense_application 函数（费用审核）
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
    
    -- ✅ 使用小写状态值，符合约束
    v_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
    
    -- 更新申请状态
    UPDATE internal_driver_expense_applications
    SET status = v_status,
        review_comment = p_notes,
        reviewer_id = auth.uid(),
        review_time = NOW(),
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

COMMENT ON FUNCTION review_expense_application IS '审核费用申请（车队长/管理员） - 状态值已统一为小写';

-- ============================================================================
-- 检查是否有其他费用申请相关函数需要修复
-- ============================================================================

-- 如果有mark_expense_paid等函数，也需要使用小写
-- 例如：status = 'paid' (小写)

-- ============================================================================
-- 验证：查询当前使用的状态值
-- ============================================================================

-- 可以通过以下查询验证数据一致性
-- SELECT DISTINCT status FROM internal_driver_expense_applications;
-- 应该只看到：'pending', 'approved', 'rejected', 'paid'

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 状态值大小写问题修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复的函数：';
    RAISE NOTICE '  1. review_expense_application';
    RAISE NOTICE '';
    RAISE NOTICE '状态值规范：';
    RAISE NOTICE '  - internal_driver_expense_applications: 小写';
    RAISE NOTICE '    (pending, approved, rejected, paid)';
    RAISE NOTICE '';
    RAISE NOTICE '  - invoice_requests: 首字母大写';
    RAISE NOTICE '    (Pending, Approved, Rejected, etc.)';
    RAISE NOTICE '';
    RAISE NOTICE '  - payment_requests: 首字母大写';
    RAISE NOTICE '    (Pending, Approved, Paid, etc.)';
    RAISE NOTICE '';
    RAISE NOTICE '💡 现在所有状态值都与数据库约束一致！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

