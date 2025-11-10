-- ============================================================
-- 修复 get_current_driver_id 函数
-- 创建时间: 2025-11-10
-- 问题: 函数只检查了 user_id 字段，没有检查 linked_user_id 字段
--       导致某些司机的账号关联在 linked_user_id 上时无法正确匹配
-- 解决: 同时检查 user_id 和 linked_user_id 两个字段
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_driver_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_user_full_name TEXT;
BEGIN
    -- 1. 优先通过 user_id 关联查找
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    IF v_driver_id IS NOT NULL THEN
        RETURN v_driver_id;
    END IF;
    
    -- 2. 如果 user_id 没有匹配，尝试通过 linked_user_id 查找
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE linked_user_id = auth.uid()
    LIMIT 1;
    
    IF v_driver_id IS NOT NULL THEN
        RETURN v_driver_id;
    END IF;
    
    -- 3. 如果都没有关联，通过姓名匹配（兼容模式）
    SELECT full_name INTO v_user_full_name
    FROM profiles
    WHERE id = auth.uid();
    
    IF v_user_full_name IS NOT NULL THEN
        SELECT id INTO v_driver_id
        FROM internal_drivers
        WHERE name = v_user_full_name
        AND employment_status = 'active'
        LIMIT 1;
    END IF;
    
    RETURN v_driver_id;
END;
$$;

COMMENT ON FUNCTION get_current_driver_id IS '获取当前登录用户对应的司机档案ID（已修复：同时检查 user_id 和 linked_user_id）';

-- ============================================================
-- 验证修复
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复完成：get_current_driver_id 函数';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  1. ✓ 优先通过 user_id 查找';
    RAISE NOTICE '  2. ✓ 如果未找到，通过 linked_user_id 查找';
    RAISE NOTICE '  3. ✓ 如果都未找到，通过姓名匹配（兼容模式）';
    RAISE NOTICE '';
    RAISE NOTICE '效果：';
    RAISE NOTICE '  ✅ 无论司机账号关联在 user_id 还是 linked_user_id 都能正确匹配';
    RAISE NOTICE '  ✅ 解决司机完成派单时找不到司机档案的问题';
    RAISE NOTICE '========================================';
END $$;

