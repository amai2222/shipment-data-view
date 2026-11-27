-- ============================================================================
-- 用途：SECURITY DEFINER 函数权限审计 + 无用函数清理（第二轮）
--
-- 审计结论（2026-11-27，生产库实测）：
--   public 下 SECURITY DEFINER 函数 381 个，分四类：
--     · 35 个 RETURNS trigger —— 不是 RPC 入口，无风险
--     · 121 个函数体内有权限校验（is_internal_user / is_admin / has_role /
--       partner_guard / get_current_partner_id / auth.uid / request.jwt）
--     · 78 个无校验且会写数据 —— 本轮处理
--     · 147 个无校验但只读 —— 本轮未动（见文末说明）
--
-- 本轮处理 78 个无校验写函数：
--   · 53 个前端零引用 + 6 个旧 _v 版本 = 59 个候选
--   · 其中 39 个无内部引用 → 归档到 archive
--   · 其中 18 个被其他 SECURITY DEFINER 函数内部调用 → 撤销 authenticated 执行权
--     （调用方全部为 SECURITY DEFINER，以属主身份调用，不受影响）
--   · 剩余 25 个有前端真实引用 → 保留，待后续逐个加校验
--
-- 验证：门户 RPC 正常；已归档函数直调 404；收权函数直调 404
-- 执行状态：已于生产库执行完毕，本文件归档
-- 回滚：见文末
-- ============================================================================

-- ============================================================================
-- 第 1 段：归档无引用函数（39 个）
-- ============================================================================
DO $seg1$
DECLARE
    r record;
    n_ok int := 0;
BEGIN
    FOR r IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.proname IN (
            'add_external_tracking_number',
            'batch_approve_payment_requests',
            'batch_import_logistics_records_backup_base',
            'batch_modify_partner_cost',
            'batch_modify_partner_cost_1126',
            'batch_rollback_invoice_approval',
            'cancel_payment_requests_by_ids',
            'complete_invoice_request',
            'create_project_completion_notification',
            'create_role_complete',
            'delete_invoice_request',
            'delete_records_by_project_name',
            'delete_role_complete',
            'fetch_comprehensive_project_report_v2',
            'fetch_comprehensive_project_report_final_v2',
            'fetch_comprehensive_project_report_final_v3',
            'fetch_comprehensive_project_report_final_v4',
            'fix_partner_name_consistency_simple',
            'get_project_dashboard_data_v2',
            'get_project_dashboard_data_v3',
            'process_logistics_import',
            'recalculate_costs_for_chain_1120',
            'recalculate_costs_for_records_safe',
            'remove_external_tracking_number',
            'resolve_and_preview_import',
            'save_invoice_request_no',
            'send_receipt_reminders_1114',
            'sync_admin_menu_from_frontend',
            'sync_all_partner_names',
            'sync_partner_names_manual',
            'sync_vehicle_tracking_ids',
            'update_external_tracking_status',
            'update_logistics_record_platforms',
            'update_logistics_record_via_recalc',
            'void_and_delete_invoice_requests',
            'void_and_delete_payment_requests',
            'void_payment_for_request',
            'void_payment_request_with_rollback',
            'void_payment_requests_by_ids'
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA archive', r.proname, r.args);
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '归档失败 %(%): %', r.proname, r.args, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE '已归档 % 个函数', n_ok;
END
$seg1$;

-- ============================================================================
-- 第 2 段：内部辅助函数 —— 撤销 authenticated 执行权（18 个）
--   这些函数被 batch_* / trigger_* 等 SECURITY DEFINER 函数内部调用，
--   前端不应直接 RPC 调用，否则可绕过外层校验。
--   调用方均为 SECURITY DEFINER（已核实），以属主身份执行，不受本变更影响。
-- ============================================================================
DO $seg2$
DECLARE
    r record;
    n_ok int := 0;
BEGIN
    FOR r IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.proname IN (
            'add_logistics_record_with_costs_v2',
            'auto_sync_admin_menu_permissions',
            'cancel_invoice_request',
            'cancel_invoice_request_1126',
            'cancel_payment_request',
            'complete_invoice_request_v2',
            'create_contract_expiry_notification',
            'create_payment_request_notification',
            'get_or_create_locations_from_string_v2',
            'notify_driver_on_dispatch',
            'notify_driver_on_expense_review',
            'notify_drivers_on_payment_approval',
            'pay_payment_request',
            'recalculate_costs_for_chain_safe_1120',
            'rollback_payment_request_approval',
            'rollback_payment_status_for_waybills',
            'sync_admin_permissions_smart',
            'sync_user_permissions_with_role'
          )
    LOOP
        BEGIN
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '收权失败 %(%): %', r.proname, r.args, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE '已撤销 % 个函数的 authenticated 执行权', n_ok;
END
$seg2$;

-- ============================================================================
-- 第 3 段：只读校验
-- ============================================================================
-- 3.1 归档区总数
SELECT count(*) AS archive_total
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'archive';

-- 3.2 归档区清单
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'archive'
ORDER BY p.proname;

-- 3.3 仍在 public 且无校验、会写数据的函数（剩余风险面）
WITH g AS (
    SELECT p.proname, p.prorettype, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
)
SELECT count(*) AS unchecked_write_remaining
FROM g
WHERE prorettype <> 'trigger'::regtype
  AND def !~* 'auth\.uid|auth\.jwt|is_internal_user|is_admin|has_role|partner_guard|get_current_partner_id|request\.jwt'
  AND def ~* '\mINSERT\s+INTO|\mDELETE\s+FROM|\mUPDATE\s+(public\.)?[a-z_]+\s+SET';

-- ============================================================================
-- ⚠️ 未处理的 147 个「无校验但只读」函数
--
-- 为什么没动：
--   1. 这些是查询类函数，被前端大量真实调用，删了页面直接白屏
--   2. 逐个加校验需要改函数体（CREATE OR REPLACE 全文），147 个无法保证回归
--   3. 它们返回的数据大多已按入参（user_id / project_id / partner_id）过滤
--
-- 真实风险：
--   SECURITY DEFINER 会绕过调用者的 RLS，若某个只读函数没做入参范围校验，
--   登录用户可通过改参数读到越权数据。需按业务逐个评估，不能批量处理。
--
-- 建议：优先评估带 partner_id / user_id 入参的那批（越权面最大）。
-- ============================================================================

-- ============================================================================
-- 回滚
-- ============================================================================
-- 5.1 单个恢复
-- ALTER FUNCTION archive.update_logistics_record_via_recalc(<args>) SET SCHEMA public;
--
-- 5.2 恢复执行权
-- GRANT EXECUTE ON FUNCTION public.recalculate_costs_for_chain_safe_1120(<args>) TO authenticated;
--
-- 5.3 全部恢复
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--            WHERE n.nspname='archive' LOOP
--     EXECUTE format('ALTER FUNCTION archive.%I(%s) SET SCHEMA public', r.proname, r.args);
--   END LOOP;
-- END $$;
-- ============================================================================
