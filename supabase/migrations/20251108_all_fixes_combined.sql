-- ============================================================================
-- 2025-11-08 所有修复的合并脚本
-- 用途: 一次性执行所有修复（除了性能索引）
-- 执行顺序: 先执行性能索引，再执行此脚本
-- ============================================================================

-- 说明：
-- 此脚本包含今日的所有功能修复，但不包含性能索引
-- 建议先单独执行 add_performance_indexes_fixed.sql
-- 然后执行此脚本

BEGIN;

-- ============================================================================
-- 修复1: get_my_waybills 函数 - 字段引用不明确
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_waybills(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    auto_number TEXT,
    project_name TEXT,
    loading_location TEXT,
    unloading_location TEXT,
    loading_date DATE,
    loading_weight NUMERIC,
    unloading_weight NUMERIC,
    payment_status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_info RECORD;
BEGIN
    -- 获取司机信息（修复：明确指定表名前缀）
    SELECT internal_drivers.id, internal_drivers.name INTO v_driver_info
    FROM internal_drivers
    WHERE internal_drivers.id = get_current_driver_id();
    
    IF v_driver_info.name IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        lr.id,
        lr.auto_number,
        lr.project_name,
        lr.loading_location,
        lr.unloading_location,
        lr.loading_date::DATE,
        lr.loading_weight,
        lr.unloading_weight,
        lr.payment_status,
        lr.created_at
    FROM logistics_records lr
    WHERE lr.driver_name = v_driver_info.name
    AND lr.loading_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ORDER BY lr.loading_date DESC, lr.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 修复2: submit_expense_application 函数 - 类型转换+申请单号+状态值
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
    v_application_number TEXT;
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
    
    -- 生成申请单号：FY + 日期 + 序号
    v_application_number := 'FY' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                            LPAD((
                                SELECT COUNT(*) + 1 
                                FROM internal_driver_expense_applications 
                                WHERE created_at::DATE = CURRENT_DATE
                            )::TEXT, 4, '0');
    
    -- 插入费用申请
    INSERT INTO internal_driver_expense_applications (
        driver_id,
        driver_name,
        application_number,
        expense_date,
        expense_type,
        amount,
        description,
        receipt_photos,
        status
    ) VALUES (
        v_driver_id,
        v_driver_name,
        v_application_number,
        p_expense_date,
        p_expense_type,
        p_amount,
        p_description,
        COALESCE(to_jsonb(p_receipt_photos), '[]'::jsonb),
        'pending'
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

-- ============================================================================
-- 修复3: review_expense_application 函数 - 状态值统一
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
    
    -- ✅ 使用小写状态值
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

-- ============================================================================
-- 添加函数注释
-- ============================================================================

COMMENT ON FUNCTION get_my_waybills IS '获取我的运单记录（内部司机专用）- 已修复字段引用问题';
COMMENT ON FUNCTION submit_expense_application IS '司机提交费用申请 - 已修复类型转换、申请单号、状态值问题';
COMMENT ON FUNCTION review_expense_application IS '审核费用申请（车队长/管理员）- 已修复状态值大小写问题';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 所有功能修复已完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容:';
    RAISE NOTICE '  1. get_my_waybills - 司机运单查询';
    RAISE NOTICE '  2. submit_expense_application - 费用申请提交';
    RAISE NOTICE '  3. review_expense_application - 费用申请审核';
    RAISE NOTICE '';
    RAISE NOTICE '影响功能:';
    RAISE NOTICE '  ✓ 司机可以查看运单';
    RAISE NOTICE '  ✓ 司机可以提交费用申请';
    RAISE NOTICE '  ✓ 司机可以查看自己的申请记录';
    RAISE NOTICE '  ✓ 车队长可以审核费用申请';
    RAISE NOTICE '';
    RAISE NOTICE '💡 建议测试:';
    RAISE NOTICE '  1. 司机端 - 我的运单';
    RAISE NOTICE '  2. 司机端 - 费用申请';
    RAISE NOTICE '  3. 车队长端 - 费用审核';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

COMMIT;

