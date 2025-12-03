-- ============================================================================
-- 步骤2：修改审批函数，添加通知逻辑
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
    v_notified BOOLEAN;
BEGIN
    -- 权限检查（车队长或管理员）
    IF NOT (public.is_admin() OR public.has_role('fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有车队长或管理员可以审核费用'
        );
    END IF;
    
    -- 使用小写状态值，符合数据库约束
    v_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
    
    -- 更新申请状态
    UPDATE internal_driver_expense_applications
    SET status = v_status,
        review_comment = p_notes,
        reviewer_id = auth.uid(),
        review_time = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;
    
    -- ✅ 通知司机
    v_notified := notify_driver_on_expense_review(p_application_id, p_approved);
    
    RETURN json_build_object(
        'success', true,
        'message', CASE WHEN p_approved THEN '费用已批准' ELSE '费用已驳回' END,
        'notified', v_notified
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '审核失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION review_expense_application IS '审核费用申请并通知司机（已更新：添加通知功能）';

