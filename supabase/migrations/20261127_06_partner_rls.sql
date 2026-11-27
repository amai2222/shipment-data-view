-- ============================================================================
-- 合作方数据隔离：结算视图 + partners 策略收紧 + 权限表补 RLS
-- 文件: supabase/migrations/20261127_06_partner_rls.sql
-- ============================================================================
-- 前置依赖（A 组 20261127_01 ~ 20261127_04）:
--   public.user_partners / public.get_visible_partner_ids() / public.is_internal_user()
-- 已存在、本文件直接复用:
--   public.can_view_partner(uuid)  -- SECURITY DEFINER，见 20250122_update_hierarchy_to_owner_only.sql
--   public.is_admin()              -- SECURITY DEFINER，见 20251102_unified_permission_check_functions.sql
--
-- 防 RLS 递归原则:
--   策略表达式里只调用 SECURITY DEFINER 辅助函数（is_internal_user / can_view_partner /
--   is_admin）或 auth.uid()，绝不在策略里直接 JOIN 受 RLS 保护的表。
--
-- 本文件不修改任何已有迁移文件。
-- ============================================================================

BEGIN;

-- ============================================================================
-- 一、结算视图 public.v_my_settlement
--     security_invoker = true，使用者的 RLS 生效
--     只暴露必要列，绝不包含 base_amount / unit_price / payable_cost
-- ============================================================================
DROP VIEW IF EXISTS public.v_my_settlement;

CREATE VIEW public.v_my_settlement
WITH (security_invoker = true)
AS
SELECT
  lpc.id                          AS cost_id,
  lpc.logistics_record_id         AS record_id,
  l.auto_number                   AS auto_number,
  COALESCE(l.project_name, '')    AS project_name,
  to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS loading_date,
  COALESCE(l.loading_location, '')      AS loading_location,
  COALESCE(l.unloading_location, '')    AS unloading_location,
  COALESCE(l.license_plate, '')         AS license_plate,
  l.effective_quantity            AS effective_quantity,
  lpc.payable_amount              AS payable_amount,
  lpc.tax_rate                    AS tax_rate,
  COALESCE(lpc.payment_status, l.payment_status)  AS payment_status,
  COALESCE(lpc.invoice_status, l.invoice_status)  AS invoice_status,
  lpc.reconciliation_status       AS reconciliation_status,
  to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') AS bill_month
FROM public.logistics_partner_costs lpc
JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
WHERE lpc.partner_id IN (
  SELECT unnest(public.get_visible_partner_ids())
);

COMMENT ON VIEW public.v_my_settlement IS
  '合作方结算视图（security_invoker，按 get_visible_partner_ids() 隔离，不含中间层金额）';

REVOKE ALL ON public.v_my_settlement FROM PUBLIC;
REVOKE ALL ON public.v_my_settlement FROM anon;
GRANT SELECT ON public.v_my_settlement TO authenticated;

-- ----------------------------------------------------------------------------
-- ⚠️ 人工确认项（默认不执行）：
--   security_invoker = true 表示视图以「调用者」身份读底层表，因此底层
--   logistics_partner_costs / logistics_records 的 RLS 必须允许合作方看到自己的行，
--   否则视图对合作方恒为空。
--   若确认需要给合作方开放表级 SELECT，请评估 base_amount 被 PostgREST 直接读取的
--   风险后，再放开下面这段（当前保持注释，合作方统一走 RPC）：
--
--   DROP POLICY IF EXISTS "logistics_partner_costs_partner_select_policy"
--     ON public.logistics_partner_costs;
--   CREATE POLICY "logistics_partner_costs_partner_select_policy"
--   ON public.logistics_partner_costs
--   FOR SELECT
--   TO authenticated
--   USING (partner_id IN (SELECT unnest(public.get_visible_partner_ids())));
-- ----------------------------------------------------------------------------


-- ============================================================================
-- 二、收紧 partners 的查询策略（原 USING(true) 等于对所有登录用户全开）
--     其它 partners 上的策略（INSERT/UPDATE/DELETE）保持原样，不做改动
-- ============================================================================
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select_policy" ON public.partners;

CREATE POLICY "partners_select_policy"
ON public.partners
FOR SELECT
TO authenticated
USING (
  public.is_internal_user()
  OR public.current_user_can_see_partner(id)  -- 基于 A 组 user_partners 的新归属判断
  OR public.can_view_partner(id)              -- 兼容旧的 partners.user_id / hierarchy_path 判定
);

COMMENT ON POLICY "partners_select_policy" ON public.partners IS
  '内部账号可读全部合作方；外部账号仅可读 user_partners 归属（含货主下级）或旧 user_id/层级关系命中的节点。三个函数均为 SECURITY DEFINER，不会产生策略递归';


-- ============================================================================
-- 三、user_permissions / user_projects / role_permission_templates 补 RLS
--     现状：三张表可被 anon key 直接写入 → 提权风险
--     目标：登录用户可读，仅 admin 可写（INSERT/UPDATE/DELETE）
-- ============================================================================

-- 3.1 清理这三张表上的历史策略，保证策略集确定（避免遗留 permissive 策略绕过）
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('user_permissions', 'user_projects', 'role_permission_templates')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    RAISE NOTICE '已移除旧策略: %.%', r.tbl, r.pol;
  END LOOP;
END $$;

-- 3.2 启用 RLS
ALTER TABLE public.user_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_templates ENABLE ROW LEVEL SECURITY;

-- 3.3 user_permissions
CREATE POLICY "user_permissions_select_authenticated"
ON public.user_permissions
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "user_permissions_insert_admin_only"
ON public.user_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "user_permissions_update_admin_only"
ON public.user_permissions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "user_permissions_delete_admin_only"
ON public.user_permissions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3.4 user_projects
CREATE POLICY "user_projects_select_authenticated"
ON public.user_projects
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "user_projects_insert_admin_only"
ON public.user_projects
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "user_projects_update_admin_only"
ON public.user_projects
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "user_projects_delete_admin_only"
ON public.user_projects
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3.5 role_permission_templates
CREATE POLICY "role_permission_templates_select_authenticated"
ON public.role_permission_templates
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "role_permission_templates_insert_admin_only"
ON public.role_permission_templates
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "role_permission_templates_update_admin_only"
ON public.role_permission_templates
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "role_permission_templates_delete_admin_only"
ON public.role_permission_templates
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3.6 anon 角色不再需要这三张表的任何权限，直接收回（双保险）
REVOKE ALL ON public.user_permissions          FROM anon;
REVOKE ALL ON public.user_projects             FROM anon;
REVOKE ALL ON public.role_permission_templates FROM anon;


-- ============================================================================
-- 四、自检
-- ============================================================================
DO $$
DECLARE
  v_rls_off     text;
  v_view        boolean;
  v_force_rls   boolean;
BEGIN
  SELECT string_agg(relname, ', ')
    INTO v_rls_off
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('partners', 'user_permissions', 'user_projects', 'role_permission_templates')
    AND relrowsecurity = false;

  IF v_rls_off IS NOT NULL THEN
    RAISE EXCEPTION '以下表未启用 RLS: %', v_rls_off;
  END IF;

  SELECT EXISTS (
           SELECT 1 FROM pg_views
           WHERE schemaname = 'public' AND viewname = 'v_my_settlement'
         )
    INTO v_view;

  IF NOT v_view THEN
    RAISE EXCEPTION '视图 public.v_my_settlement 创建失败';
  END IF;

  -- partners 若被 FORCE ROW LEVEL SECURITY，can_view_partner() 内部读 partners 会再次触发
  -- 本策略，造成 infinite recursion。此处仅告警，需人工确认。
  SELECT relforcerowsecurity INTO v_force_rls
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relname = 'partners';

  IF COALESCE(v_force_rls, false) THEN
    RAISE WARNING 'partners 表启用了 FORCE ROW LEVEL SECURITY，can_view_partner() 可能触发策略递归，请人工确认';
  END IF;

  RAISE NOTICE '✅ 合作方数据隔离迁移完成：v_my_settlement / partners 策略收紧 / 权限表 RLS';
END $$;

COMMIT;
