-- ============================================================================
-- 测试菜单更新操作（模拟前端admin用户）
-- ============================================================================
-- 这个脚本需要以普通用户身份运行，不是service_role
-- ============================================================================

-- 1. 查看当前用户信息
SELECT 
    'current_user' AS label,
    auth.uid() AS value;

SELECT 
    'user_email' AS label,
    (SELECT email FROM profiles WHERE id = auth.uid()) AS value;

SELECT 
    'user_role' AS label,
    (SELECT role::text FROM profiles WHERE id = auth.uid()) AS value;

-- 2. 测试是否是管理员
SELECT 
    'is_admin_check' AS label,
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'::app_role
    ) AS value;

-- 3. 尝试更新一个菜单（测试）
-- 注意：这只是测试，如果成功会实际修改数据
DO $$
DECLARE
    v_test_menu_id UUID;
    v_current_active BOOLEAN;
BEGIN
    -- 获取第一个菜单
    SELECT id, is_active INTO v_test_menu_id, v_current_active
    FROM menu_config
    LIMIT 1;
    
    -- 尝试切换状态
    UPDATE menu_config
    SET is_active = NOT v_current_active
    WHERE id = v_test_menu_id;
    
    RAISE NOTICE '✅ 更新成功！菜单ID: %, 状态切换: % → %', 
        v_test_menu_id, 
        v_current_active, 
        NOT v_current_active;
    
    -- 立即回滚（不保存更改）
    UPDATE menu_config
    SET is_active = v_current_active
    WHERE id = v_test_menu_id;
    
    RAISE NOTICE '✅ 已回滚，数据未实际修改';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ 更新失败: %', SQLERRM;
        RAISE NOTICE '';
        RAISE NOTICE '可能的原因：';
        RAISE NOTICE '  1. 当前不是以用户身份登录（而是service_role）';
        RAISE NOTICE '  2. 当前用户不是admin角色';
        RAISE NOTICE '  3. RLS策略有问题';
        RAISE NOTICE '';
        RAISE NOTICE '请在前端使用 admin 用户登录后测试';
END $$;

