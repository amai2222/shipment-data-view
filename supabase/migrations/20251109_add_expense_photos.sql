-- ============================================================================
-- 添加费用申请补充图片功能
-- 创建时间: 2025-11-09
-- 功能: 允许司机在已提交的费用申请中补充上传图片
-- ============================================================================

-- 创建追加图片到费用申请的 RPC 函数
CREATE OR REPLACE FUNCTION add_expense_application_photos(
    p_application_id UUID,
    p_additional_photos TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_driver_id UUID;
    v_current_photos JSONB;
    v_updated_photos JSONB;
    v_application_exists BOOLEAN;
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
    
    -- 检查申请是否存在且属于当前司机
    SELECT EXISTS(
        SELECT 1 
        FROM internal_driver_expense_applications 
        WHERE id = p_application_id 
        AND driver_id = v_driver_id
    ) INTO v_application_exists;
    
    IF NOT v_application_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '申请不存在或无权操作'
        );
    END IF;
    
    -- 获取当前图片数组
    SELECT COALESCE(receipt_photos, '[]'::jsonb) 
    INTO v_current_photos
    FROM internal_driver_expense_applications
    WHERE id = p_application_id;
    
    -- 合并图片数组（追加新图片）
    v_updated_photos := v_current_photos || to_jsonb(p_additional_photos);
    
    -- 更新申请记录
    UPDATE internal_driver_expense_applications
    SET 
        receipt_photos = v_updated_photos,
        updated_at = NOW()
    WHERE id = p_application_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '图片已成功添加',
        'total_photos', jsonb_array_length(v_updated_photos)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '添加图片失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION add_expense_application_photos IS '追加图片到费用申请（司机补充上传）';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION add_expense_application_photos TO authenticated;

