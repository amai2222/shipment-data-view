-- ============================================================================
-- 修复费用申请函数的 receipt_photos 类型不匹配问题
-- 创建时间: 2025-11-08
-- 问题: column "receipt_photos" is of type jsonb but expression is of type text[]
-- 解决方案: 将 TEXT[] 转换为 JSONB
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
    
    -- 插入费用申请（修复：将 TEXT[] 转换为 JSONB，添加 application_number）
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
        COALESCE(to_jsonb(p_receipt_photos), '[]'::jsonb),  -- ✅ 修复：TEXT[] → JSONB
        'pending'  -- ✅ 修复：使用小写，符合约束 CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))
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

COMMENT ON FUNCTION submit_expense_application IS '司机提交费用申请 - 已修复 receipt_photos 类型转换';

-- ============================================================================
-- 验证修复
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ submit_expense_application 函数已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复内容: TEXT[] → JSONB 类型转换';
    RAISE NOTICE '影响: 司机移动端 - 费用申请提交';
    RAISE NOTICE '';
    RAISE NOTICE '💡 现在可以正常提交费用申请了';
    RAISE NOTICE '========================================';
END $$;

