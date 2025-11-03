-- ============================================================================
-- 修复 menu_config 表的更新权限问题
-- ============================================================================
-- 问题：管理员无法修改菜单配置（更新/禁用）
-- 错误："new row violates row-level security policy for table 'menu_config'"
-- 原因：UPDATE 策略的 WITH CHECK 子句可能有问题
-- ============================================================================

BEGIN;

-- 查看当前的 RLS 策略
SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'menu_config'
ORDER BY cmd, policyname;

-- 删除旧策略
DROP POLICY IF EXISTS "menu_config_select_policy" ON public.menu_config;
DROP POLICY IF EXISTS "menu_config_insert_policy" ON public.menu_config;
DROP POLICY IF EXISTS "menu_config_update_policy" ON public.menu_config;
DROP POLICY IF EXISTS "menu_config_delete_policy" ON public.menu_config;

-- 重新创建策略

-- SELECT：所有已认证用户可以读取启用的菜单
CREATE POLICY "menu_config_select_policy"
ON public.menu_config
FOR SELECT
TO authenticated
USING (true);  -- 允许读取所有菜单（包括禁用的，用于配置管理）

-- INSERT：只有管理员可以创建菜单
CREATE POLICY "menu_config_insert_policy"
ON public.menu_config
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE：只有管理员可以更新菜单（关键修复）
CREATE POLICY "menu_config_update_policy"
ON public.menu_config
FOR UPDATE
TO authenticated
USING (
    -- 允许管理员读取
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    -- 允许管理员更新为任何值（关键：不限制更新后的状态）
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- DELETE：只有管理员可以删除菜单
CREATE POLICY "menu_config_delete_policy"
ON public.menu_config
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

COMMIT;

-- 验证策略
DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_config';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ menu_config RLS 策略已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '策略数量: %', v_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '权限说明：';
    RAISE NOTICE '  - SELECT: 所有认证用户可读取';
    RAISE NOTICE '  - INSERT: 仅管理员可创建';
    RAISE NOTICE '  - UPDATE: 仅管理员可修改（无限制）';
    RAISE NOTICE '  - DELETE: 仅管理员可删除';
    RAISE NOTICE '';
    RAISE NOTICE '现在管理员可以：';
    RAISE NOTICE '  ✅ 启用/禁用菜单';
    RAISE NOTICE '  ✅ 修改菜单标题、图标、顺序';
    RAISE NOTICE '  ✅ 删除菜单';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- 测试当前用户权限
SELECT 
    auth.uid() AS current_user,
    (SELECT role FROM profiles WHERE id = auth.uid()) AS user_role,
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) AS is_admin;

