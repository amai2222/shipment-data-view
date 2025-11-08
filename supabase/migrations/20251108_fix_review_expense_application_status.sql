-- ============================================================================
-- 修复 review_expense_application 函数的状态值大小写问题
-- 创建时间: 2025-11-08
-- 问题: 使用首字母大写的状态值，违反数据库约束
-- 解决方案: 统一使用小写状态值
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
    
    -- ✅ 修复：使用小写状态值，符合数据库约束
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

COMMENT ON FUNCTION review_expense_application IS '审核费用申请 - 已修复状态值大小写问题';

-- ============================================================================
-- 验证修复
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ review_expense_application 函数已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复内容: 状态值统一为小写';
    RAISE NOTICE '  - Approved → approved';
    RAISE NOTICE '  - Rejected → rejected';
    RAISE NOTICE '';
    RAISE NOTICE '影响: 车队长移动端和PC端 - 费用审核功能';
    RAISE NOTICE '';
    RAISE NOTICE '💡 现在可以正常审核费用申请了';
    RAISE NOTICE '========================================';
END $$;

