-- ============================================================================
-- 费用申请审批时通知司机
-- 创建时间: 2025-11-25
-- 功能: 当费用申请被审批通过或驳回时，自动通知相关司机
-- ============================================================================

BEGIN;

-- ============================================================================
-- 第一步：创建通知司机的辅助函数
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_driver_on_expense_review(
    p_application_id UUID,
    p_approved BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_user_id UUID;
    v_application_amount NUMERIC;
    v_application_reason TEXT;
    v_driver_name TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
    v_notification_link TEXT;
BEGIN
    -- 获取费用申请信息
    SELECT 
        eda.driver_id,
        eda.amount,
        eda.reason,
        id.user_id,
        id.linked_user_id,
        id.full_name
    INTO 
        v_driver_id,
        v_application_amount,
        v_application_reason,
        v_user_id,
        v_driver_name
    FROM internal_driver_expense_applications eda
    LEFT JOIN internal_drivers id ON eda.driver_id = id.id
    WHERE eda.id = p_application_id;
    
    -- 如果找不到申请记录，返回 false
    IF v_driver_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- 确定要通知的用户ID（优先级：internal_drivers.user_id > linked_user_id）
    -- 如果上面查询已经获取了 user_id，直接使用；否则重新查询
    IF v_user_id IS NULL THEN
        SELECT COALESCE(user_id, linked_user_id)
        INTO v_user_id
        FROM internal_drivers
        WHERE id = v_driver_id;
    END IF;
    
    -- 如果找不到用户ID，返回 false
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- 设置通知内容
    IF p_approved THEN
        v_notification_title := '费用申请已通过';
        v_notification_message := format(
            '您的费用申请已审批通过。金额：¥%s，原因：%s。您可以在"我的费用"页面查看详情。',
            COALESCE(v_application_amount::TEXT, '0'),
            COALESCE(v_application_reason, '无')
        );
        v_notification_link := '/m/internal/my-expenses';
    ELSE
        v_notification_title := '费用申请已驳回';
        v_notification_message := format(
            '您的费用申请已被驳回。金额：¥%s，原因：%s。如有疑问，请联系管理员。',
            COALESCE(v_application_amount::TEXT, '0'),
            COALESCE(v_application_reason, '无')
        );
        v_notification_link := '/m/internal/my-expenses';
    END IF;
    
    -- 创建通知
    INSERT INTO notifications (
        user_id,
        type,
        category,
        title,
        message,
        link,
        related_id
    ) VALUES (
        v_user_id,
        CASE WHEN p_approved THEN 'success' ELSE 'warning' END,
        'finance',
        v_notification_title,
        v_notification_message,
        v_notification_link,
        p_application_id::TEXT
    );
    
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    -- 记录错误但不中断审批流程
    RAISE WARNING '创建费用审批通知失败: %', SQLERRM;
    RETURN false;
END;
$$;

COMMENT ON FUNCTION notify_driver_on_expense_review IS '费用申请审批时通知司机';

-- ============================================================================
-- 第二步：修改审批函数，添加通知逻辑
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

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 费用申请审批通知功能已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '功能: 费用申请审批时自动通知司机';
    RAISE NOTICE '  - 审批通过：发送成功通知';
    RAISE NOTICE '  - 审批驳回：发送警告通知';
    RAISE NOTICE '';
    RAISE NOTICE '影响: 车队长移动端和PC端 - 费用审核功能';
    RAISE NOTICE '';
    RAISE NOTICE '💡 现在司机可以收到费用审批通知了';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

