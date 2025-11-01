-- ============================================================================
-- 修复 role_permission_templates 表的 RLS 策略
-- ============================================================================
-- 问题: role_permission_templates 表启用了 RLS，但没有相应的策略，导致更新失败
-- 错误: new row violates row-level security policy for table "role_permission_templates"
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: 检查表是否存在并确认 RLS 状态
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'role_permission_templates'
    ) THEN
        RAISE NOTICE '表 role_permission_templates 不存在，跳过策略创建';
        RETURN;
    END IF;
END $$;

-- ============================================================================
-- Step 2: 删除可能存在的旧策略（如果存在）
-- ============================================================================

DROP POLICY IF EXISTS "role_permission_templates_select_policy" ON public.role_permission_templates;
DROP POLICY IF EXISTS "role_permission_templates_insert_policy" ON public.role_permission_templates;
DROP POLICY IF EXISTS "role_permission_templates_update_policy" ON public.role_permission_templates;
DROP POLICY IF EXISTS "role_permission_templates_delete_policy" ON public.role_permission_templates;
DROP POLICY IF EXISTS "Admins can manage role permission templates" ON public.role_permission_templates;
DROP POLICY IF EXISTS "Everyone can view role permission templates" ON public.role_permission_templates;

-- ============================================================================
-- Step 3: 创建新的 RLS 策略
-- ============================================================================

-- 策略 1: 所有已认证用户都可以查看角色模板
CREATE POLICY "role_permission_templates_select_policy"
ON public.role_permission_templates
FOR SELECT
TO authenticated
USING (true);

-- 策略 2: 管理员可以插入新角色模板
CREATE POLICY "role_permission_templates_insert_policy"
ON public.role_permission_templates
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- 策略 3: 管理员可以更新角色模板
CREATE POLICY "role_permission_templates_update_policy"
ON public.role_permission_templates
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- 策略 4: 管理员可以删除角色模板（非系统模板）
CREATE POLICY "role_permission_templates_delete_policy"
ON public.role_permission_templates
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
    AND (
        -- 不允许删除系统角色模板
        NOT COALESCE(is_system, false)
    )
);

-- ============================================================================
-- Step 4: 验证策略创建
-- ============================================================================

DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'role_permission_templates';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ role_permission_templates RLS 策略已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '策略数量: %', v_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '策略说明:';
    RAISE NOTICE '  ✅ SELECT: 所有已认证用户可查看';
    RAISE NOTICE '  ✅ INSERT: 仅管理员可创建';
    RAISE NOTICE '  ✅ UPDATE: 仅管理员可更新';
    RAISE NOTICE '  ✅ DELETE: 仅管理员可删除（非系统模板）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- 完成
-- ============================================================================

