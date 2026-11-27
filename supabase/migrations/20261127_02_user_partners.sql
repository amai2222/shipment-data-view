-- ============================================================================
-- 用途：
--   建立“系统用户 ↔ 合作方（货主/合作商）”的账号归属关系表 public.user_partners，
--   并提供 4 个数据可见范围函数，作为后续 RLS / RPC 判断“这个账号能看到哪些合作方数据”
--   的统一入口（替代散落各处的硬编码判断）。
--
-- 风险等级：低
--   - 只新增表/索引/函数/策略，不改动任何已有对象；
--   - user_partners 初始为空，创建后若不回填，get_current_partner_id() 会返回 NULL，
--     依赖它的新逻辑会“看不到任何合作方数据”（不会越权，只会偏保守）。
--
-- 前置检查：执行前先跑第 1 段（依赖对象存在性检查：profiles / partners 及其字段）。
--
-- 回滚方式：见文件末尾注释块（手工执行）。
--
-- 执行位置：Supabase Dashboard → SQL Editor（本项目未接入 CLI 迁移）
-- 幂等性：可重复执行（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
--         策略先查 pg_policies 再建 / CREATE OR REPLACE FUNCTION）。
-- ============================================================================

-- ============================================================================
-- 第 1 段【前置检查】：依赖对象与字段是否齐备
-- ============================================================================
DO $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.profiles 不存在，请先确认项目 schema 完整。';
    END IF;

    IF to_regclass('public.partners') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.partners 不存在，请先确认项目 schema 完整。';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN
        RAISE EXCEPTION '前置检查失败：public.profiles 缺少 role 字段，无法实现 is_internal_user()。';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'partners' AND column_name = 'hierarchy_path'
    ) THEN
        RAISE EXCEPTION '前置检查失败：public.partners 缺少 hierarchy_path 字段，无法实现 get_visible_partner_ids()。';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'partners' AND column_name = 'partner_type'
    ) THEN
        RAISE EXCEPTION '前置检查失败：public.partners 缺少 partner_type 字段，无法判断是否递归下级。';
    END IF;

    RAISE NOTICE '第 1 段通过：profiles / partners 依赖字段齐备。';
END;
$$;

-- ============================================================================
-- 第 2 段：建表
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_partners (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    partner_id  UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    relation    TEXT NOT NULL DEFAULT 'owner'
                CHECK (relation IN ('owner', 'viewer')),
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_user_partners_user_partner UNIQUE (user_id, partner_id)
);

COMMENT ON TABLE  public.user_partners IS '系统用户与合作方的归属关系（一个账号可关联多个合作方）';
COMMENT ON COLUMN public.user_partners.user_id    IS '系统用户ID，关联 profiles.id';
COMMENT ON COLUMN public.user_partners.partner_id IS '合作方ID，关联 partners.id';
COMMENT ON COLUMN public.user_partners.relation   IS '关系：owner（归属/所有者）或 viewer（只读）';
COMMENT ON COLUMN public.user_partners.is_primary IS '是否为主合作方；一个用户仅应有一条 is_primary=true 的记录';

CREATE INDEX IF NOT EXISTS idx_user_partners_user
    ON public.user_partners (user_id);

CREATE INDEX IF NOT EXISTS idx_user_partners_partner
    ON public.user_partners (partner_id);

-- ============================================================================
-- 第 3 段：启用 RLS
-- ============================================================================
ALTER TABLE public.user_partners ENABLE ROW LEVEL SECURITY;

-- 本人可读自己的行
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_partners'
          AND policyname = 'user_partners_select_self'
    ) THEN
        CREATE POLICY user_partners_select_self
            ON public.user_partners
            FOR SELECT
            TO authenticated
            USING (user_id = auth.uid());
    END IF;

    -- admin 可读写（FOR ALL 覆盖 SELECT/INSERT/UPDATE/DELETE）
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_partners'
          AND policyname = 'user_partners_all_admin'
    ) THEN
        CREATE POLICY user_partners_all_admin
            ON public.user_partners
            FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END;
$$;

-- 其余角色（finance/business/operator/viewer/partner/driver 等）没有匹配策略 → 不可见
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_partners TO authenticated;

-- 后台任务 / service_role 需要完整权限（Supabase 新表不会自动继承表权限）
GRANT ALL ON public.user_partners TO service_role;

-- ============================================================================
-- 第 4 段：函数
--   全部 SECURITY DEFINER + SET search_path = public + STABLE
--   目的：绕过 user_partners / profiles / partners 自身的 RLS，避免策略递归。
-- ============================================================================

-- 4.1 当前用户的主合作方
CREATE OR REPLACE FUNCTION public.get_current_partner_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_partner_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT up.partner_id
    INTO v_partner_id
    FROM public.user_partners up
    WHERE up.user_id = auth.uid()
    ORDER BY up.is_primary DESC, up.created_at ASC
    LIMIT 1;

    RETURN v_partner_id;
END;
$$;

COMMENT ON FUNCTION public.get_current_partner_id() IS
  '取当前登录用户的主合作方ID（is_primary 优先，其次 created_at 最早）；无关联返回 NULL';

-- 4.2 当前用户可见的合作方ID集合
--     业务口径（2026-11-27 明确）：分包商只看自己，货主也只看自己，不做上下级穿透。
--     上级/下级关系只用于内部管理与展示，不构成数据可见性。
CREATE OR REPLACE FUNCTION public.get_visible_partner_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_partner_id UUID;
BEGIN
    v_partner_id := public.get_current_partner_id();

    -- 未绑定合作方 → 空集合（不越权，只会看不到数据）
    IF v_partner_id IS NULL THEN
        RETURN ARRAY[]::UUID[];
    END IF;

    -- 严格只返回本主体一个，不递归下级
    RETURN ARRAY[v_partner_id];
END;
$$;

COMMENT ON FUNCTION public.get_visible_partner_ids() IS
  '当前用户可见的合作方ID数组：严格仅本主体一个（分包商/货主均只看自己，不穿透上下级）';

-- 4.3 是否内部员工
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT p.role::TEXT INTO v_role
    FROM public.profiles p
    WHERE p.id = auth.uid();

    RETURN COALESCE(v_role IN ('admin', 'finance', 'business', 'operator', 'viewer'), FALSE);
END;
$$;

COMMENT ON FUNCTION public.is_internal_user() IS
  '当前用户是否内部员工（admin/finance/business/operator/viewer）';

-- 4.4 便利函数：当前用户能否看到指定合作方
CREATE OR REPLACE FUNCTION public.current_user_can_see_partner(p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    IF p_partner_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 内部员工不受合作方归属限制
    IF public.is_internal_user() THEN
        RETURN TRUE;
    END IF;

    RETURN p_partner_id = ANY (public.get_visible_partner_ids());
END;
$$;

COMMENT ON FUNCTION public.current_user_can_see_partner(UUID) IS
  '当前用户是否可查看指定合作方：内部员工恒为 true；外部账号限自己及（货主）下级';

GRANT EXECUTE ON FUNCTION public.get_current_partner_id()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_partner_ids()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_partner(UUID)     TO authenticated;

-- ============================================================================
-- 完成提示
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '20261127_02_user_partners.sql 执行完成';
    RAISE NOTICE '  - 表 public.user_partners（RLS 已启用）';
    RAISE NOTICE '  - 策略：本人只读自己 / admin 读写 / 其他角色不可见';
    RAISE NOTICE '  - 函数：get_current_partner_id / get_visible_partner_ids /';
    RAISE NOTICE '          is_internal_user / current_user_can_see_partner';
    RAISE NOTICE '⚠️ user_partners 目前为空，需另行回填账号归属后功能才生效';
    RAISE NOTICE '========================================';
END;
$$;

-- ============================================================================
-- 回滚 SQL（手工执行，本文件不会自动执行以下语句）
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.current_user_can_see_partner(UUID);
-- DROP FUNCTION IF EXISTS public.is_internal_user();
-- DROP FUNCTION IF EXISTS public.get_visible_partner_ids();
-- DROP FUNCTION IF EXISTS public.get_current_partner_id();
-- DROP TABLE IF EXISTS public.user_partners;
