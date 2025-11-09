-- ============================================================================
-- 添加支付凭证功能到费用申请表
-- 创建时间: 2025-11-09
-- 功能: 车队长审核时可以上传支付凭证，已审核记录也可以补充支付凭证
-- ============================================================================

-- 添加支付凭证字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'internal_driver_expense_applications' 
        AND column_name = 'payment_vouchers'
    ) THEN
        ALTER TABLE internal_driver_expense_applications
        ADD COLUMN payment_vouchers JSONB DEFAULT '[]'::jsonb;
        
        RAISE NOTICE '✅ 已添加 payment_vouchers 字段';
    ELSE
        RAISE NOTICE '⚠️  payment_vouchers 字段已存在';
    END IF;
END $$;

COMMENT ON COLUMN internal_driver_expense_applications.payment_vouchers IS '支付凭证照片URL数组（JSONB格式，七牛云存储）';

-- ============================================================================
-- 创建更新支付凭证的 RPC 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION add_payment_vouchers(
    p_application_id UUID,
    p_payment_vouchers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_vouchers JSONB;
    v_updated_vouchers JSONB;
    v_application_exists BOOLEAN;
    v_is_fleet_manager BOOLEAN;
BEGIN
    -- 获取当前用户
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '用户未登录'
        );
    END IF;
    
    -- 检查权限（车队长或管理员）
    SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = v_user_id 
        AND role IN ('fleet_manager', 'admin', 'finance')
    ) INTO v_is_fleet_manager;
    
    IF NOT v_is_fleet_manager THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '权限不足：只有车队长、财务或管理员可以上传支付凭证'
        );
    END IF;
    
    -- 检查申请是否存在
    SELECT EXISTS(
        SELECT 1 
        FROM internal_driver_expense_applications 
        WHERE id = p_application_id
    ) INTO v_application_exists;
    
    IF NOT v_application_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '申请不存在'
        );
    END IF;
    
    -- 获取当前支付凭证数组
    SELECT COALESCE(payment_vouchers, '[]'::jsonb) 
    INTO v_current_vouchers
    FROM internal_driver_expense_applications
    WHERE id = p_application_id;
    
    -- 合并支付凭证数组（追加新凭证）
    v_updated_vouchers := v_current_vouchers || to_jsonb(p_payment_vouchers);
    
    -- 更新申请记录
    UPDATE internal_driver_expense_applications
    SET 
        payment_vouchers = v_updated_vouchers,
        updated_at = NOW()
    WHERE id = p_application_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '支付凭证已成功添加',
        'total_vouchers', jsonb_array_length(v_updated_vouchers)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '添加支付凭证失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION add_payment_vouchers IS '添加支付凭证到费用申请（车队长/财务/管理员）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION add_payment_vouchers TO authenticated;

-- ============================================================================
-- 创建审核时同时上传支付凭证的函数（可选，如果需要在审核时一起上传）
-- ============================================================================

CREATE OR REPLACE FUNCTION review_expense_application_with_vouchers(
    p_application_id UUID,
    p_approved BOOLEAN,
    p_notes TEXT DEFAULT NULL,
    p_payment_vouchers TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_current_vouchers JSONB;
    v_updated_vouchers JSONB;
BEGIN
    -- 权限检查（车队长或管理员）
    IF NOT (public.is_admin() OR public.has_role('fleet_manager')) THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有车队长或管理员可以审核费用'
        );
    END IF;
    
    -- 使用小写状态值
    v_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
    
    -- 如果有支付凭证，合并到现有凭证
    IF p_payment_vouchers IS NOT NULL AND array_length(p_payment_vouchers, 1) > 0 THEN
        SELECT COALESCE(payment_vouchers, '[]'::jsonb) 
        INTO v_current_vouchers
        FROM internal_driver_expense_applications
        WHERE id = p_application_id;
        
        v_updated_vouchers := v_current_vouchers || to_jsonb(p_payment_vouchers);
    ELSE
        v_updated_vouchers := NULL;  -- 不更新支付凭证
    END IF;
    
    -- 更新申请状态和支付凭证
    UPDATE internal_driver_expense_applications
    SET 
        status = v_status,
        review_comment = p_notes,
        reviewer_id = auth.uid(),
        review_time = NOW(),
        updated_at = NOW(),
        payment_vouchers = COALESCE(v_updated_vouchers, payment_vouchers)  -- 如果有新凭证则更新，否则保持原值
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

COMMENT ON FUNCTION review_expense_application_with_vouchers IS '审核费用申请并同时上传支付凭证（可选）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION review_expense_application_with_vouchers TO authenticated;

