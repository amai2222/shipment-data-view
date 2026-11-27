-- ============================================================================
-- 用途：安全收紧函数层权限 + 归档废弃函数
--
--   1) 214 个函数补齐 search_path（原来为 NULL，Postgres 使用默认路径）
--   2) 407 个 SECURITY DEFINER 函数取消 anon 执行权（原来 PUBLIC 默认可执行）
--   3) 归档 36 个历史版本函数到 archive schema（可逆，非 DROP）
--
-- 前置分析（已在生产库核实）：
--   - 559 个 public 函数中，0 个引用 storage/extensions/net/vault/cron/pg_temp
--   - 0 个使用非限定的 crypt/gen_salt/digest/hmac/uuid_generate/unaccent
--   - 仅 2 个使用 gen_random_uuid()（PG13+ 内置，位于 pg_catalog，不受 search_path 影响）
--   => search_path = public, auth 对全部函数安全
--
--   - 登录页 / AuthContext / 重置密码页均无 .rpc() 调用（登录走 GoTrue）
--   => 取消 anon 执行权不会影响登录流程
--
-- 实测：已登录账号调 RPC 正常返回；匿名调用返回 401
-- 执行状态：2026-11-27 已在生产库执行完毕，本文件为归档
-- 回滚：见文件末尾
-- ============================================================================

-- ============================================================================
-- 第 1 段：补齐 search_path
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
          AND NOT EXISTS (
              SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
              WHERE c LIKE 'search_path%'
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, auth', r.proname, r.args);
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '设置 search_path 失败 %(%): %', r.proname, r.args, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'search_path 已补齐 % 个函数', n_ok;
END
$seg1$;

-- ============================================================================
-- 第 2 段：取消 anon 执行权，保留 authenticated / service_role
--   Postgres 函数默认 GRANT EXECUTE TO PUBLIC，只 REVOKE FROM anon 无效，
--   必须同时 REVOKE FROM PUBLIC 再显式 GRANT 给需要的角色。
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
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
    LOOP
        BEGIN
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
            EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
            EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '收紧权限失败 %(%): %', r.proname, r.args, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE '已取消 % 个函数的 anon 执行权', n_ok;
END
$seg2$;

-- ============================================================================
-- 第 3 段：归档废弃函数（移动 schema，不 DROP）
--
-- 判定标准（三条同时满足）：
--   a. 属于同名函数族的「非最新日期版本」
--   b. 前端无任何真实 .rpc('name') 调用（仅在自动生成的 types.ts 中出现不算）
--   c. 无内部引用（无其他函数体调用）、无 pg_depend 依赖
--
-- ⚠️ 注意：get_payment_request_data_v2_1122 曾误判归档，
--    已恢复回 public —— 前端 src/pages/... 有真实调用。
--    恢复语句：ALTER FUNCTION archive.xxx(...) SET SCHEMA public
-- ============================================================================
DO $seg3$
BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS archive';
    EXECUTE 'REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated';
    EXECUTE 'COMMENT ON SCHEMA archive IS ''历史废弃函数存档：仅 postgres 可访问，确认无调用后可 DROP''';
END
$seg3$;

DO $seg4$
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
            'add_logistics_record_with_costs_1120',
            'batch_import_logistics_records_1112',
            'batch_import_logistics_records_with_update_1123',
            'batch_recalculate_by_filter_1116',
            'get_all_filtered_record_ids_1113',
            'get_all_filtered_record_ids_1115',
            'get_all_filtered_record_ids_1116',
            'get_all_filtered_record_ids_1120',
            'get_drivers_paginated_0827',
            'get_filtered_unpaid_ids_1116',
            'get_filtered_unpaid_ids_1120',
            'get_finance_reconciliation_by_partner_1115',
            'get_finance_reconciliation_by_partner_1116',
            'get_finance_reconciliation_by_partner_1120',
            'get_invoice_request_data_1113',
            'get_invoice_requests_filtered_1113',
            'get_invoice_requests_filtered_1114',
            'get_invoice_requests_filtered_1115',
            'get_invoice_requests_filtered_1116',
            'get_logistics_summary_and_records_enhanced_1113',
            'get_logistics_summary_and_records_enhanced_1115',
            'get_logistics_summary_and_records_enhanced_1116',
            'get_logistics_summary_and_records_enhanced_1120',
            'get_payment_request_data_0827',
            'get_payment_request_data_1113',
            'get_payment_request_data_1116',
            'get_payment_request_data_1120',
            'get_payment_requests_filtered_1113',
            'get_payment_requests_filtered_1116',
            'get_receipt_details_report_1114',
            'get_receipt_statistics_1114',
            'get_shipper_dashboard_stats_1115',
            'get_subordinate_shippers_stats_1115',
            'modify_logistics_record_chain_with_recalc_1120',
            'save_invoice_request_1014'
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
$seg4$;

-- ============================================================================
-- 第 4 段：只读校验
-- ============================================================================
-- 4.1 剩余未设 search_path 的函数（应为 0）
SELECT count(*) AS still_no_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path%');

-- 4.2 仍可被 anon 执行的函数（应为 0）
SELECT count(*) AS anon_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- 4.3 归档区函数清单
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'archive'
ORDER BY p.proname;

-- ============================================================================
-- 回滚
-- ============================================================================
-- 4.x 单个恢复（推荐，先恢复再排查）
-- ALTER FUNCTION archive.get_drivers_paginated_0827(text, integer, integer) SET SCHEMA public;
--
-- 4.y 全部恢复
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--            WHERE n.nspname='archive' LOOP
--     EXECUTE format('ALTER FUNCTION archive.%I(%s) SET SCHEMA public', r.proname, r.args);
--   END LOOP;
-- END $$;
--
-- 4.z 恢复 anon 执行权（仅在确有匿名调用需求时）
-- GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO anon;
-- ============================================================================
