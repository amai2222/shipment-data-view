-- ============================================================================
-- 用途：给只读 SECURITY DEFINER 函数补权限校验（第 15 轮，收官）
--
-- 背景：只读函数虽然不改数据，但 SECURITY DEFINER 会绕过 RLS，
--       任何登录用户（含分包商、司机）都能调用内部报表读到全量数据。
--       实测确认：分包商曾能读 get_pending_payments（192 万待付）、
--       get_partner_ranking（全部合作商金额排名）。
--
-- 分三类校验，避免误伤移动端：
--
--   A. 通知类（入参 p_user_id）
--      get_user_notifications / get_unread_notification_count
--      → p_user_id = auth.uid() OR is_internal_user()
--
--   B. 车队经理报表（移动端车队经理在用）
--      get_dashboard_stats_with_billing_types_1113, get_monthly_receivables,
--      get_monthly_trends, get_total_receivables, get_partner_ranking,
--      get_pending_invoicing, get_pending_payments, get_project_dashboard_data,
--      get_payment_requests_filtered_1120, get_invoice_requests_filtered_1120,
--      get_driver_balances_by_fleet_manager
--      → is_internal_user() OR role = 'fleet_manager'
--
--   C. 其余内部报表（约 110 个）
--      → is_internal_user()
--
--   D. 车辆-司机关系（LANGUAGE sql，无 BEGIN 锚点，需改写为 plpgsql）
--      get_driver_vehicles / get_vehicle_drivers
--      → is_internal_user() OR role IN ('fleet_manager','driver')
--
--   E. 查重类（内部录入去重）
--      check_logistics_record_duplicate(×3 重载) / check_logistics_record_duplicate_v2(×2)
--      get_filtered_uninvoiced_record_ids(×2)
--      → is_internal_user()
--
-- 未加校验且无需加的：
--   has_role                   权限判断基础函数，只返回布尔，无数据泄露；加校验会递归
--   get_my_dispatch_orders     已有 get_current_driver_id() 范围限制
--   get_my_driver_info         同上
--   get_my_salary              同上
--   get_my_vehicle_change_applications 同上
--   get_my_waybills            同上
--   get_driver_expense_balance / get_my_vehicles  已有 role_check
--   17 个内部辅助函数           上一轮已 REVOKE authenticated
--   cancel_payment_status_for_waybills / set_payment_status_for_waybills
--                              本轮补 REVOKE authenticated（调用方为 secdef）
--
-- 最终状态（public，非 trigger，SECURITY DEFINER）：305 个
--   285 个有校验 + 20 个为「基础函数 / 已收权 / 已有 driver 范围限制」
--
-- 实测（partner02，role=partner）：
--   get_pending_payments            → 403
--   get_partner_ranking             → 403
--   get_monthly_trends              → 403
--   get_dashboard_stats_..._1113    → 403
--   get_user_notifications(他人)    → 403
--   partner_get_overview            → 200（门户不受影响）
--   partner_get_waybills            → 200
--
-- 执行状态：已于 2026-11-27 在生产库执行，本文件归档
-- ============================================================================

-- ============================================================================
-- 第 1 段：按类别批量注入（plpgsql 函数，overlay 插入）
-- ============================================================================
DO $inj$
DECLARE
    r record;
    v_key text;
    v_def text;
    v_new text;
    v_pos int;
    v_beg int;
    v_chk text;
    n_ok int := 0;
    n_bad int := 0;
    err text := '';

    fm_list text[] := ARRAY[
        'get_dashboard_stats_with_billing_types_1113','get_monthly_receivables',
        'get_monthly_trends','get_total_receivables','get_partner_ranking',
        'get_pending_invoicing','get_pending_payments','get_project_dashboard_data',
        'get_payment_requests_filtered_1120','get_invoice_requests_filtered_1120',
        'get_driver_balances_by_fleet_manager'
    ];
    fleet_list text[] := ARRAY['get_driver_vehicles','get_vehicle_drivers'];
    notif_list text[] := ARRAY['get_user_notifications','get_unread_notification_count'];
    skip_list  text[] := ARRAY[
        'has_role','get_my_dispatch_orders','get_my_driver_info','get_my_salary',
        'get_my_vehicle_change_applications','get_my_waybills',
        'get_driver_expense_balance','get_my_vehicles'
    ];
BEGIN
    FOR r IN
        SELECT DISTINCT p.proname
        FROM pg_proc p
        JOIN pg_namespace s ON s.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
        WHERE s.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
          AND p.prorettype <> 'trigger'::regtype
          AND l.lanname = 'plpgsql'
          AND NOT (p.prosrc ~* 'is_internal_user|is_admin|has_role|partner_guard|get_current_partner_id|auth\.uid|auth\.jwt|request\.jwt|has_function_permission|has_permission|has_page_access|get_current_driver_id')
          AND NOT (p.prosrc ~* 'INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+public')
          AND p.proname <> ALL (skip_list)
    LOOP
        SELECT pg_get_functiondef(p.oid) INTO v_def
        FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
        WHERE s.nspname = 'public' AND p.proname = r.proname
        LIMIT 1;

        IF r.proname = ANY(notif_list) THEN
            v_chk := E'\n  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_internal_user() THEN\n'
                  || E'    RAISE EXCEPTION ''无权查看他人通知'' USING ERRCODE = ''42501'';\n  END IF;\n';
        ELSIF r.proname = ANY(fm_list) OR r.proname = ANY(fleet_list) THEN
            v_chk := E'\n  IF NOT (public.is_internal_user() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role::text IN (''fleet_manager'',''driver''))) THEN\n'
                  || E'    RAISE EXCEPTION ''权限不足'' USING ERRCODE = ''42501'';\n  END IF;\n';
        ELSE
            v_chk := E'\n  IF NOT public.is_internal_user() THEN\n'
                  || E'    RAISE EXCEPTION ''权限不足：需要内部账号'' USING ERRCODE = ''42501'';\n  END IF;\n';
        END IF;

        v_pos := position('$function$' in v_def);
        v_beg := position('BEGIN' in substring(v_def from v_pos + 10));

        IF v_pos = 0 OR v_beg = 0 THEN
            n_bad := n_bad + 1;
            err := err || r.proname || ':no_anchor | ';
        ELSE
            v_new := overlay(v_def placing v_chk from (v_pos + 10 + v_beg - 1 + 5) for 0);
            BEGIN
                EXECUTE v_new;
                n_ok := n_ok + 1;
            EXCEPTION WHEN OTHERS THEN
                n_bad := n_bad + 1;
                err := err || r.proname || ':' || left(SQLERRM, 50) || ' | ';
            END;
        END IF;
    END LOOP;

    RAISE NOTICE '注入成功 % 个，失败 % 个：%', n_ok, n_bad, left(err, 400);
END
$inj$;

-- ============================================================================
-- 第 2 段：LANGUAGE sql 函数改写为 plpgsql（无 BEGIN 锚点，只能整函数替换）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_driver_vehicles(p_driver_id uuid)
RETURNS TABLE(vehicle_id uuid, license_plate text, vehicle_type text, is_primary boolean, relation_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $f$
BEGIN
    IF NOT (public.is_internal_user() OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role::text IN ('fleet_manager','driver')
    )) THEN
        RAISE EXCEPTION '权限不足' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT v.id AS vehicle_id, v.license_plate, v.vehicle_type, dvr.is_primary, dvr.relation_type
    FROM public.internal_vehicles v
    INNER JOIN public.internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = p_driver_id
    ORDER BY dvr.is_primary DESC, v.license_plate;
END
$f$;

CREATE OR REPLACE FUNCTION public.get_vehicle_drivers(p_vehicle_id uuid)
RETURNS TABLE(driver_id uuid, driver_name text, phone text, is_primary boolean, relation_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $f$
BEGIN
    IF NOT (public.is_internal_user() OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role::text IN ('fleet_manager','driver')
    )) THEN
        RAISE EXCEPTION '权限不足' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT d.id AS driver_id, d.name AS driver_name, d.phone, dvr.is_primary, dvr.relation_type
    FROM public.internal_drivers d
    INNER JOIN public.internal_driver_vehicle_relations dvr ON d.id = dvr.driver_id
    WHERE dvr.vehicle_id = p_vehicle_id
    ORDER BY dvr.is_primary DESC, d.name;
END
$f$;

-- ============================================================================
-- 第 3 段：两个漏网的内部辅助函数收回 authenticated 执行权
--   cancel_payment_status_for_waybills  调用方 void_payment_for_request_1126(secdef)
--   set_payment_status_for_waybills     无调用方
-- ============================================================================
DO $rv$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.cancel_payment_status_for_waybills FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.set_payment_status_for_waybills FROM authenticated;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '收权失败: %', SQLERRM;
END
$rv$;

-- ============================================================================
-- 第 4 段：只读校验
-- ============================================================================
SELECT count(*) AS secdef_nontrigger,
       count(*) FILTER (WHERE prosrc ~* 'is_internal_user|is_admin|has_role|partner_guard|get_current_partner_id|auth\.uid|auth\.jwt|request\.jwt|has_function_permission|has_permission|has_page_access|get_current_driver_id') AS with_check,
       count(*) FILTER (WHERE prosrc !~* 'is_internal_user|is_admin|has_role|partner_guard|get_current_partner_id|auth\.uid|auth\.jwt|request\.jwt|has_function_permission|has_permission|has_page_access|get_current_driver_id') AS no_check
FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
WHERE s.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  AND p.prorettype <> 'trigger'::regtype;
