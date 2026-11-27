-- ============================================================================
-- 用途：消除 Supabase Security Advisor 的 CRITICAL 项，并真正收紧数据隔离
--   1) 删除无用视图 v_my_settlement（曾被标记为 Security Definer View，且无任何引用）
--   2) 两个视图改为 security_invoker，让 RLS 对调用者生效
--   3) 9 张表启用 RLS，并按「谁的数据」而不是「谁登录了」写策略
--
-- 背景：这 9 张表此前 RLS 关闭。由于 anon key 随前端公开，
--       未登录者也能读写这些数据。本次同时修掉这个暴露面。
--
-- 风险等级：中
--   - 启用 RLS 后，未登录（anon）访问立即失效；已登录用户的可见范围按下述策略收敛
--   - 不修改任何数据行、不涉及金额
--
-- 执行状态：已于 2026-11-27 通过 MCP 在生产库执行完毕，本文件用于归档
-- 回滚：见文件末尾
-- ============================================================================

-- ============================================================================
-- 第 1 段：视图
-- ============================================================================
DROP VIEW IF EXISTS public.v_my_settlement;

ALTER VIEW public.logistics_records_view SET (security_invoker = true);
ALTER VIEW public.logistics_records_status_summary SET (security_invoker = true);

-- ============================================================================
-- 第 2 段：内部管理表 —— 只给内部员工 / 车队经理 / 司机
--   表：internal_vehicle_driver_history / expense_details / monthly_income /
--       monthly_summary / v_p_policy_count
-- ============================================================================
DO $seg2$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'internal_vehicle_driver_history',
        'internal_vehicle_expense_details',
        'internal_vehicle_monthly_income',
        'internal_vehicle_monthly_summary',
        'v_p_policy_count'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_select_internal'
        ) THEN
            EXECUTE format($f$
                CREATE POLICY %I ON public.%I
                FOR SELECT TO authenticated
                USING (
                    public.is_internal_user()
                    OR EXISTS (
                        SELECT 1 FROM public.profiles pr
                        WHERE pr.id = auth.uid()
                          AND pr.role::text IN ('fleet_manager', 'driver')
                    )
                )
            $f$, t || '_select_internal', t);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_write_internal'
        ) THEN
            EXECUTE format($f$
                CREATE POLICY %I ON public.%I
                FOR ALL TO authenticated
                USING (public.is_internal_user())
                WITH CHECK (public.is_internal_user())
            $f$, t || '_write_internal', t);
        END IF;
    END LOOP;
END
$seg2$;

-- ============================================================================
-- 第 3 段：按主体隔离的表
--   partner_balance / partner_balance_transactions：外部只看自己那一行
--   fleet_manager_projects：车队经理只看自己分配的项目
--   invoice_receipt_records：外部只看自己发起的开票申请回执
-- ============================================================================
DO $seg3$
BEGIN
    -- 3.1 余额
    DROP POLICY IF EXISTS partner_balance_select_authenticated ON public.partner_balance;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_balance' AND policyname='partner_balance_select_own') THEN
        CREATE POLICY partner_balance_select_own ON public.partner_balance
            FOR SELECT TO authenticated
            USING (public.is_internal_user() OR partner_id = public.get_current_partner_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_balance' AND policyname='partner_balance_write_internal') THEN
        CREATE POLICY partner_balance_write_internal ON public.partner_balance
            FOR ALL TO authenticated
            USING (public.is_internal_user())
            WITH CHECK (public.is_internal_user());
    END IF;

    -- 3.2 余额流水
    DROP POLICY IF EXISTS partner_balance_transactions_select_authenticated ON public.partner_balance_transactions;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_balance_transactions' AND policyname='partner_balance_tx_select_own') THEN
        CREATE POLICY partner_balance_tx_select_own ON public.partner_balance_transactions
            FOR SELECT TO authenticated
            USING (public.is_internal_user() OR partner_id = public.get_current_partner_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_balance_transactions' AND policyname='partner_balance_transactions_write_internal') THEN
        CREATE POLICY partner_balance_transactions_write_internal ON public.partner_balance_transactions
            FOR ALL TO authenticated
            USING (public.is_internal_user())
            WITH CHECK (public.is_internal_user());
    END IF;

    -- 3.3 车队经理 ↔ 项目
    DROP POLICY IF EXISTS fleet_manager_projects_select_authenticated ON public.fleet_manager_projects;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fleet_manager_projects' AND policyname='fleet_manager_projects_select_scoped') THEN
        CREATE POLICY fleet_manager_projects_select_scoped ON public.fleet_manager_projects
            FOR SELECT TO authenticated
            USING (public.is_internal_user() OR fleet_manager_id = auth.uid());
    END IF;

    -- 3.4 开票回执
    DROP POLICY IF EXISTS invoice_receipt_records_select_authenticated ON public.invoice_receipt_records;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_receipt_records' AND policyname='invoice_receipt_records_select_scoped') THEN
        CREATE POLICY invoice_receipt_records_select_scoped ON public.invoice_receipt_records
            FOR SELECT TO authenticated
            USING (
                public.is_internal_user()
                OR EXISTS (
                    SELECT 1 FROM public.invoice_requests ir
                    WHERE ir.id = invoice_receipt_records.invoice_request_id
                      AND ir.partner_id = public.get_current_partner_id()
                )
            );
    END IF;
END
$seg3$;

-- ============================================================================
-- 第 4 段：只读校验（可单独执行）
-- ============================================================================
-- 4.1 每张表的 RLS 与策略
SELECT c.relname, c.relrowsecurity AS rls_on,
       (SELECT string_agg(p.polname, ' | ' ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'internal_vehicle_driver_history','internal_vehicle_expense_details',
    'internal_vehicle_monthly_income','internal_vehicle_monthly_summary','v_p_policy_count',
    'fleet_manager_projects','invoice_receipt_records',
    'partner_balance','partner_balance_transactions'
  )
ORDER BY c.relname;

-- 4.2 视图是否已切换为 invoker
SELECT c.relname, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND c.relname IN ('logistics_records_view','logistics_records_status_summary');

-- ============================================================================
-- 回滚（手工执行，会影响数据可见性，慎用）
-- ============================================================================
-- ALTER TABLE public.partner_balance DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.partner_balance_transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.fleet_manager_projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoice_receipt_records DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.internal_vehicle_driver_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.internal_vehicle_expense_details DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.internal_vehicle_monthly_income DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.internal_vehicle_monthly_summary DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.v_p_policy_count DISABLE ROW LEVEL SECURITY;
-- ALTER VIEW public.logistics_records_view RESET (security_invoker);
-- ALTER VIEW public.logistics_records_status_summary RESET (security_invoker);
-- ============================================================================
