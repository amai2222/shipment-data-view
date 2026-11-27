-- ============================================================================
-- 用途：给无权限校验的写操作函数补校验 + 修复统一权限函数的类型 bug
--
-- 一、修复既有 bug（重要）
--   public.has_function_permission(text) 内部：
--       FROM role_permission_templates WHERE role = v_user_role
--   role_permission_templates.role 是 app_role 枚举，v_user_role 是 text，
--   Postgres 报 `operator does not exist: app_role = text`。
--   影响：所有走「角色模板」分支的权限判断都会抛错 → 38 个使用该函数的业务
--   函数（付款、审批、作废等）在用户无自定义权限时可能直接失败。
--   修复：改为 role::text = v_user_role。
--
-- 二、给 6 个写操作补校验（原先完全无校验，任何登录用户可调用）
--   delete_single_logistics_record            → data.delete
--   delete_waybills_by_project                → data.delete
--   delete_waybills_by_project_and_date       → data.delete
--   approve_payment_request                   → finance.approve_payment
--   batch_recalculate_partner_costs           → finance.modify_cost
--   batch_recalculate_partner_costs_1120      → finance.modify_cost
--   update_logistics_record_via_recalc_1128   → data.edit
--
-- 三、5 个函数补「42501 透传」
--   这些函数体末尾有 EXCEPTION WHEN OTHERS 兜底，会把权限异常转成
--   {success:false} 并返回 HTTP 200，前端无法区分「无权」和「业务失败」。
--   改为 EXCEPTION WHEN SQLSTATE '42501' THEN RAISE; WHEN OTHERS THEN ...
--
-- 权限键归属（role_permission_templates 现状）：
--   data.delete          → admin, operator
--   data.edit            → admin, business, operator, fleet_manager
--   finance.modify_cost  → admin, operator
--   finance.approve_payment → admin, finance, operator
--
-- 实测（partner02 账号，role=partner）：
--   6 个函数全部返回 HTTP 403 + code 42501「权限不足」
--
-- 执行状态：已于 2026-11-27 在生产库执行，本文件归档
-- ============================================================================

-- ============================================================================
-- 第 1 段：修复 has_function_permission 的枚举/文本比较
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_function_permission(p_function_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_has_permission boolean := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role::text INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- admin 自动拥有全部权限
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- 1) 用户自定义全局权限
    SELECT EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
          AND p_function_key = ANY (function_permissions)
          AND array_length(function_permissions, 1) > 0
    ) INTO v_has_permission;
    IF v_has_permission THEN
        RETURN TRUE;
    END IF;

    -- 2) 有自定义记录但权限数组为空 → 明确禁止
    IF EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = v_user_id AND project_id IS NULL
    ) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_permissions
            WHERE user_id = v_user_id
              AND project_id IS NULL
              AND (function_permissions IS NULL OR array_length(function_permissions, 1) = 0)
        ) INTO v_has_permission;
        IF v_has_permission THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- 3) 角色模板兜底（关键修复：role 是 app_role，必须 cast）
    SELECT EXISTS (
        SELECT 1 FROM public.role_permission_templates
        WHERE role::text = v_user_role
          AND p_function_key = ANY (function_permissions)
          AND array_length(function_permissions, 1) > 0
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$fn$;

-- ============================================================================
-- 第 2 段：给 6 个写函数插入权限校验（在第一个 BEGIN 之后）
--   用 overlay(.. for 0) 插入，不覆盖原文；已含校验的跳过。
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
BEGIN
    FOR r IN
        SELECT DISTINCT p.proname
        FROM pg_proc p
        JOIN pg_namespace nn ON nn.oid = p.pronamespace
        WHERE nn.nspname = 'public' AND p.prokind = 'f'
          AND p.proname IN (
            'delete_single_logistics_record',
            'delete_waybills_by_project',
            'delete_waybills_by_project_and_date',
            'approve_payment_request',
            'batch_recalculate_partner_costs',
            'batch_recalculate_partner_costs_1120',
            'update_logistics_record_via_recalc_1128'
          )
    LOOP
        SELECT pg_get_functiondef(p.oid) INTO v_def
        FROM pg_proc p JOIN pg_namespace nn ON nn.oid = p.pronamespace
        WHERE nn.nspname = 'public' AND p.proname = r.proname
        LIMIT 1;

        IF v_def ~ 'has_function_permission' THEN
            CONTINUE;
        END IF;

        v_key := CASE r.proname
            WHEN 'delete_single_logistics_record' THEN 'data.delete'
            WHEN 'delete_waybills_by_project' THEN 'data.delete'
            WHEN 'delete_waybills_by_project_and_date' THEN 'data.delete'
            WHEN 'update_logistics_record_via_recalc_1128' THEN 'data.edit'
            WHEN 'batch_recalculate_partner_costs' THEN 'finance.modify_cost'
            WHEN 'batch_recalculate_partner_costs_1120' THEN 'finance.modify_cost'
            WHEN 'approve_payment_request' THEN 'finance.approve_payment'
        END;

        v_pos := position('$function$' in v_def);
        v_beg := position('BEGIN' in substring(v_def from v_pos + 10));

        v_chk := E'\n  IF NOT public.has_function_permission(''' || v_key || ''') THEN\n'
              || E'    RAISE EXCEPTION ''权限不足：需要 ' || v_key || ' 权限'' USING ERRCODE = ''42501'';\n'
              || E'  END IF;\n';

        v_new := overlay(v_def placing v_chk from (v_pos + 10 + v_beg - 1 + 5) for 0);

        BEGIN
            EXECUTE v_new;
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '注入失败 %: %', r.proname, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE '已注入 % 个函数', n_ok;
END
$inj$;

-- ============================================================================
-- 第 3 段：5 个函数补 42501 透传（避免权限异常被兜底吞成 HTTP 200）
-- ============================================================================
DO $thr$
DECLARE
    r record;
    v_def text;
    v_new text;
    n_ok int := 0;
BEGIN
    FOR r IN
        SELECT DISTINCT p.proname
        FROM pg_proc p JOIN pg_namespace nn ON nn.oid = p.pronamespace
        WHERE nn.nspname = 'public' AND p.prokind = 'f'
          AND p.proname IN (
            'delete_single_logistics_record',
            'delete_waybills_by_project',
            'delete_waybills_by_project_and_date',
            'batch_recalculate_partner_costs',
            'batch_recalculate_partner_costs_1120'
          )
    LOOP
        SELECT pg_get_functiondef(p.oid) INTO v_def
        FROM pg_proc p JOIN pg_namespace nn ON nn.oid = p.pronamespace
        WHERE nn.nspname = 'public' AND p.proname = r.proname
        LIMIT 1;

        IF v_def ~ 'WHEN SQLSTATE ''42501''' THEN
            CONTINUE;
        END IF;

        v_new := regexp_replace(
            v_def,
            'EXCEPTION\s+WHEN\s+OTHERS\s+THEN',
            'EXCEPTION WHEN SQLSTATE ''42501'' THEN RAISE; WHEN OTHERS THEN',
            'g'
        );

        IF v_new = v_def THEN
            RAISE WARNING '% 无可替换的 EXCEPTION 子句', r.proname;
            CONTINUE;
        END IF;

        BEGIN
            EXECUTE v_new;
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '透传改造失败 %: %', r.proname, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE '已改造 % 个函数', n_ok;
END
$thr$;

-- ============================================================================
-- 第 4 段：只读校验
-- ============================================================================
SELECT p.proname,
       (p.prosrc ~ 'has_function_permission')   AS has_check,
       (p.prosrc ~ 'WHEN SQLSTATE ''42501''')   AS rethrows_42501
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'delete_single_logistics_record','delete_waybills_by_project',
    'delete_waybills_by_project_and_date','approve_payment_request',
    'batch_recalculate_partner_costs','batch_recalculate_partner_costs_1120',
    'update_logistics_record_via_recalc_1128'
  )
ORDER BY 1;

-- ============================================================================
-- ⚠️ 本轮未处理的（低危或需特殊语义）
--
--   get_partner_balance            只读余额 + 顺带 INSERT 空记录；入参 partner_id
--                                  未校验，任何登录用户可查任意主体余额。
--                                  应改为「内部员工 或 partner_id = get_current_partner_id()」
--   delete_notification            通知类，需按 user_id 过滤而非角色
--   mark_notification_as_read      同上
--   mark_all_notifications_as_read 同上
--   get_or_create_locations_from_string   写地点字典，内部辅助性质，建议 data.create
--   update_location_geocoding             地理编码回填，建议 data.edit
--   batch_import_logistics_records—buneng 名字含中文破折号，显然是废弃件，可归档
--   reject_dispatch_order          与 accept_dispatch_order 对称，已用
--                                  get_current_driver_id() 限定司机本人，无需另加
--
-- 回滚：GRANT/REVOKE 层面无需回滚；函数体改动可用 archive 或 git 历史恢复。
-- ============================================================================
