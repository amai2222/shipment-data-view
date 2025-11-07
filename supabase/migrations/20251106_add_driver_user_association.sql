-- ============================================================================
-- 添加司机用户关联功能
-- 创建日期：2025-11-06
-- 功能：将司机角色的用户账号与内部司机档案关联
-- ============================================================================

-- ============================================================================
-- 第一步：添加user_id字段到internal_drivers表
-- ============================================================================

ALTER TABLE internal_drivers
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN internal_drivers.user_id IS '关联的用户账号ID（司机登录账号）';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_internal_drivers_user_id 
ON internal_drivers(user_id);

-- 添加唯一约束（一个用户只能关联一个司机档案）
ALTER TABLE internal_drivers
DROP CONSTRAINT IF EXISTS internal_drivers_user_id_unique;

ALTER TABLE internal_drivers
ADD CONSTRAINT internal_drivers_user_id_unique 
UNIQUE (user_id);

-- ============================================================================
-- 第二步：创建查询函数 - 获取未关联的司机和用户
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unlinked_drivers_and_users()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'unlinked_drivers', (
            SELECT json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'phone', phone,
                    'employment_status', employment_status,
                    'user_id', user_id
                )
            )
            FROM internal_drivers
            -- 包含所有司机，前端可以筛选
        ),
        'driver_role_users', (
            SELECT json_agg(
                json_build_object(
                    'id', id,
                    'email', email,
                    'phone', phone,
                    'full_name', raw_user_meta_data->>'full_name',
                    'created_at', created_at
                )
            )
            FROM auth.users
            WHERE raw_user_meta_data->>'role' = 'driver'
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_unlinked_drivers_and_users IS '获取司机档案和司机角色用户列表（用于关联）';

-- ============================================================================
-- 第三步：创建关联/解除关联函数
-- ============================================================================

CREATE OR REPLACE FUNCTION link_driver_to_user(
    p_driver_id UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_name TEXT;
    v_user_email TEXT;
BEGIN
    -- 权限检查
    IF NOT public.is_admin() THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有管理员可以关联司机账号'
        );
    END IF;
    
    -- 检查司机是否存在
    SELECT name INTO v_driver_name
    FROM internal_drivers
    WHERE id = p_driver_id;
    
    IF v_driver_name IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '司机档案不存在'
        );
    END IF;
    
    -- 检查用户是否存在且是司机角色
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = p_user_id
    AND raw_user_meta_data->>'role' = 'driver';
    
    IF v_user_email IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '用户不存在或不是司机角色'
        );
    END IF;
    
    -- 检查该用户是否已关联其他司机
    IF EXISTS (
        SELECT 1 FROM internal_drivers 
        WHERE user_id = p_user_id 
        AND id != p_driver_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'message', '该用户账号已关联其他司机'
        );
    END IF;
    
    -- 执行关联
    UPDATE internal_drivers
    SET user_id = p_user_id,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN json_build_object(
        'success', true,
        'message', format('成功关联：司机"%s"已绑定用户账号"%s"', v_driver_name, v_user_email)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '关联失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION link_driver_to_user IS '关联司机档案到用户账号';

-- 解除关联函数
CREATE OR REPLACE FUNCTION unlink_driver_from_user(
    p_driver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有管理员可以解除关联'
        );
    END IF;
    
    SELECT name INTO v_driver_name
    FROM internal_drivers
    WHERE id = p_driver_id;
    
    IF v_driver_name IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '司机档案不存在'
        );
    END IF;
    
    UPDATE internal_drivers
    SET user_id = NULL,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN json_build_object(
        'success', true,
        'message', format('已解除司机"%s"的用户账号关联', v_driver_name)
    );
END;
$$;

COMMENT ON FUNCTION unlink_driver_from_user IS '解除司机档案的用户账号关联';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 司机用户关联功能已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已添加：';
    RAISE NOTICE '  ✓ internal_drivers.user_id 字段';
    RAISE NOTICE '  ✓ get_unlinked_drivers_and_users() 函数';
    RAISE NOTICE '  ✓ link_driver_to_user() 函数';
    RAISE NOTICE '  ✓ unlink_driver_from_user() 函数';
    RAISE NOTICE '';
    RAISE NOTICE '用途：';
    RAISE NOTICE '  • 在设置中管理司机账号关联';
    RAISE NOTICE '  • 一个用户只能关联一个司机档案';
    RAISE NOTICE '  • 关联后司机可以登录使用移动端';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

