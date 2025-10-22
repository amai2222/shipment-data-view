-- ==========================================
-- 修复视图的 RLS 策略
-- ==========================================
-- 创建时间: 2025-01-22
-- 问题: 
--   以下视图显示 "Unrestricted" 警告：
--   1. logistics_records_view
--   2. logistics_records_status_summary
--   3. partners_hierarchy_view
-- 解决:
--   视图不能直接启用 RLS，需要确保底层表启用了 RLS
--   视图会自动继承底层表的 RLS 策略
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步：为 logistics_records 表添加 RLS 策略
-- （logistics_records_view 和 logistics_records_status_summary 的底层表）
-- ============================================================

-- 启用 RLS
ALTER TABLE public.logistics_records ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "logistics_records_select_policy" ON public.logistics_records;

-- 创建新策略：允许已认证用户根据项目权限查看
CREATE POLICY "logistics_records_select_policy"
ON public.logistics_records
FOR SELECT
TO authenticated
USING (
    -- 管理员可以看到所有数据
    public.is_admin()
    OR
    -- 用户可以看到自己有权限的项目的运单
    project_id IN (
        SELECT project_id 
        FROM public.user_projects 
        WHERE user_id = auth.uid()
    )
);

-- ============================================================
-- 第二步：为 partners 表添加 RLS 策略
-- （partners_hierarchy_view 的底层表）
-- ============================================================

-- 启用 RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "partners_select_policy" ON public.partners;

-- 创建新策略：允许已认证用户查看所有合作方
-- （货主层级对所有登录用户可见，因为需要在项目配置中使用）
CREATE POLICY "partners_select_policy"
ON public.partners
FOR SELECT
TO authenticated
USING (true);  -- 所有已认证用户都可以查看合作方

-- ============================================================
-- 第三步：验证 RLS 策略
-- ============================================================

DO $$
DECLARE
    v_rls_enabled BOOLEAN;
    v_policy_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS 策略验证';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 检查 logistics_records 表
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = 'logistics_records' AND relnamespace = 'public'::regnamespace;
    
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'logistics_records';
    
    RAISE NOTICE 'logistics_records 表（底层表）:';
    RAISE NOTICE '  • RLS 已启用: %', COALESCE(v_rls_enabled::text, 'false');
    RAISE NOTICE '  • 策略数量: %', v_policy_count;
    
    -- 检查 partners 表
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = 'partners' AND relnamespace = 'public'::regnamespace;
    
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'partners';
    
    RAISE NOTICE '';
    RAISE NOTICE 'partners 表（底层表）:';
    RAISE NOTICE '  • RLS 已启用: %', COALESCE(v_rls_enabled::text, 'false');
    RAISE NOTICE '  • 策略数量: %', v_policy_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '视图会自动继承底层表的 RLS 策略！';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS 策略配置完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已配置策略的底层表：';
    RAISE NOTICE '  ✓ logistics_records（运单表）';
    RAISE NOTICE '  ✓ partners（合作方表）';
    RAISE NOTICE '';
    RAISE NOTICE '受影响的视图（自动继承）：';
    RAISE NOTICE '  ✓ logistics_records_view';
    RAISE NOTICE '  ✓ logistics_records_status_summary';
    RAISE NOTICE '  ✓ partners_hierarchy_view';
    RAISE NOTICE '';
    RAISE NOTICE '安全规则：';
    RAISE NOTICE '  • 运单数据：用户只能看到有权限的项目数据';
    RAISE NOTICE '  • 合作方数据：所有登录用户可见';
    RAISE NOTICE '  • 管理员：可以看到所有数据';
    RAISE NOTICE '';
    RAISE NOTICE '现在刷新 Supabase Dashboard，';
    RAISE NOTICE '"Unrestricted" 警告应该消失了！';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
