-- ==========================================
-- 修复视图 RLS 策略
-- ==========================================
-- 注意：视图不能直接启用 RLS，需要确保底层表启用了 RLS
-- 视图会自动继承底层表的 RLS 策略

BEGIN;

-- ============================================================
-- 第一步：确保底层表启用了 RLS
-- ============================================================

-- 1. logistics_records 表（logistics_records_view 的底层表）
ALTER TABLE public.logistics_records ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "logistics_records_select_policy" ON public.logistics_records;

-- 创建新策略
CREATE POLICY "logistics_records_select_policy"
ON public.logistics_records
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR
    project_id IN (
        SELECT project_id 
        FROM public.user_projects 
        WHERE user_id = auth.uid()
    )
);

-- 2. partners 表（partners_hierarchy_view 的底层表）
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "partners_select_policy" ON public.partners;

-- 创建新策略：所有已认证用户可以查看合作方
CREATE POLICY "partners_select_policy"
ON public.partners
FOR SELECT
TO authenticated
USING (true);

COMMIT;

-- ============================================================
-- 第二步：验证配置
-- ============================================================

DO $$
DECLARE
    v_lr_rls BOOLEAN;
    v_lr_policy_count INTEGER;
    v_p_rls BOOLEAN;
    v_p_policy_count INTEGER;
BEGIN
    -- 检查 logistics_records 表
    SELECT relrowsecurity INTO v_lr_rls
    FROM pg_class
    WHERE relname = 'logistics_records' AND relnamespace = 'public'::regnamespace;
    
    SELECT COUNT(*) INTO v_lr_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'logistics_records';
    
    -- 检查 partners 表
    SELECT relrowsecurity INTO v_p_rls
    FROM pg_class
    WHERE relname = 'partners' AND relnamespace = 'public'::regnamespace;
    
    SELECT COUNT(*) INTO v_p_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'partners';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS 策略配置完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'logistics_records 表：';
    RAISE NOTICE '  • RLS 已启用: %', COALESCE(v_lr_rls::text, 'false');
    RAISE NOTICE '  • 策略数量: %', v_lr_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'partners 表：';
    RAISE NOTICE '  • RLS 已启用: %', COALESCE(v_p_rls::text, 'false');
    RAISE NOTICE '  • 策略数量: %', v_p_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '视图会自动继承底层表的 RLS 策略！';
    RAISE NOTICE '刷新 Supabase Dashboard，红色警告应该消失了！';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
