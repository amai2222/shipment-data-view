-- ============================================================================
-- 派单时通知司机
-- 创建时间: 2025-11-25
-- 功能: 当车队长派单时，自动通知相关司机
-- ============================================================================

BEGIN;

-- ============================================================================
-- 第一步：创建通知司机的辅助函数
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_driver_on_dispatch(
    p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_user_id UUID;
    v_linked_user_id UUID;
    v_order_number TEXT;
    v_project_name TEXT;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_expected_loading_date DATE;
    v_notification_title TEXT;
    v_notification_message TEXT;
    v_notification_link TEXT;
BEGIN
    -- 获取派单信息
    SELECT 
        d.driver_id,
        d.order_number,
        d.loading_location,
        d.unloading_location,
        d.expected_loading_date,
        p.name as project_name,
        id.user_id,
        id.linked_user_id
    INTO 
        v_driver_id,
        v_order_number,
        v_loading_location,
        v_unloading_location,
        v_expected_loading_date,
        v_project_name,
        v_user_id,
        v_linked_user_id
    FROM dispatch_orders d
    LEFT JOIN projects p ON d.project_id = p.id
    LEFT JOIN internal_drivers id ON d.driver_id = id.id
    WHERE d.id = p_order_id;
    
    -- 如果找不到派单记录，返回 false
    IF v_driver_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- 确定要通知的用户ID（优先级：internal_drivers.user_id > linked_user_id）
    v_user_id := COALESCE(v_user_id, v_linked_user_id);
    
    -- 如果找不到用户ID，返回 false
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- 设置通知内容
    v_notification_title := '新派单通知';
    v_notification_message := format(
        '您收到新的派单任务。派单编号：%s，项目：%s，路线：%s → %s%s。请及时查看并处理。',
        COALESCE(v_order_number, ''),
        COALESCE(v_project_name, '未知项目'),
        COALESCE(v_loading_location, ''),
        COALESCE(v_unloading_location, ''),
        CASE 
            WHEN v_expected_loading_date IS NOT NULL 
            THEN format('，预期装货日期：%s', to_char(v_expected_loading_date, 'YYYY-MM-DD'))
            ELSE ''
        END
    );
    v_notification_link := '/m/internal/my-dispatches';
    
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
        'info',
        'business',
        v_notification_title,
        v_notification_message,
        v_notification_link,
        p_order_id::TEXT
    );
    
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    -- 记录错误但不中断派单流程
    RAISE WARNING '创建派单通知失败: %', SQLERRM;
    RETURN false;
END;
$$;

COMMENT ON FUNCTION notify_driver_on_dispatch IS '派单时通知司机';

-- ============================================================================
-- 第二步：修改 create_dispatch_order 函数，添加通知逻辑
-- ============================================================================

CREATE OR REPLACE FUNCTION create_dispatch_order(
    p_project_id UUID,
    p_driver_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_expected_loading_date DATE DEFAULT NULL,
    p_expected_weight NUMERIC DEFAULT NULL,
    p_current_cost NUMERIC DEFAULT 0,
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_number TEXT;
    v_order_id UUID;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_notified BOOLEAN;
BEGIN
    -- 权限检查
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有车队长或管理员可以派单'
        );
    END IF;
    
    -- 生成派单编号
    v_order_number := 'PD' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                      LPAD((
                          SELECT COUNT(*) + 1 
                          FROM dispatch_orders 
                          WHERE created_at::DATE = CURRENT_DATE
                      )::TEXT, 4, '0');
    
    -- 获取地点名称
    SELECT name INTO v_loading_location FROM locations WHERE id = p_loading_location_id;
    SELECT name INTO v_unloading_location FROM locations WHERE id = p_unloading_location_id;
    
    -- 创建派单（包含运费字段）
    INSERT INTO dispatch_orders (
        order_number,
        project_id,
        driver_id,
        fleet_manager_id,
        loading_location_id,
        unloading_location_id,
        loading_location,
        unloading_location,
        expected_loading_date,
        expected_weight,
        expected_cost,
        remarks,
        status
    ) VALUES (
        v_order_number,
        p_project_id,
        p_driver_id,
        auth.uid(),
        p_loading_location_id,
        p_unloading_location_id,
        v_loading_location,
        v_unloading_location,
        p_expected_loading_date,
        p_expected_weight,
        COALESCE(p_current_cost, 0),
        p_remarks,
        'pending'
    )
    RETURNING id INTO v_order_id;
    
    -- ✅ 通知司机
    v_notified := notify_driver_on_dispatch(v_order_id);
    
    RETURN json_build_object(
        'success', true,
        'message', '派单成功',
        'order_id', v_order_id,
        'order_number', v_order_number,
        'notified', v_notified
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '派单失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION create_dispatch_order IS '创建派单并通知司机（已更新：添加通知功能）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 派单通知功能已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '功能: 车队长派单时自动通知司机';
    RAISE NOTICE '  - 通知类型：信息通知';
    RAISE NOTICE '  - 通知分类：业务通知';
    RAISE NOTICE '  - 通知内容：包含派单编号、项目、路线等信息';
    RAISE NOTICE '';
    RAISE NOTICE '影响: 车队长移动端和PC端 - 派单功能';
    RAISE NOTICE '';
    RAISE NOTICE '💡 现在司机可以收到派单通知了';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

