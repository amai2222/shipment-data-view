-- ============================================================================
-- 用途：补齐最后 8 个无权限校验函数的防护（第 14 轮）
--
--   1) delete_notification                按「本人或内部员工」限制
--   2) mark_notification_as_read          同上
--   3) mark_all_notifications_as_read     同上
--   4) get_partner_balance                内部员工 或 本人主体
--   5) get_or_create_locations_from_string  → data.create
--   6) update_location_geocoding           → data.edit
--   7) batch_import_logistics_records—buneng  → 归档（名字含中文破折号，废弃件）
--   8) reject_dispatch_order               → 已具备司机本人校验，无需改动（见文末）
--
-- 前四个函数体极短，直接整函数重写；5、6 用 overlay 在 BEGIN 后插入校验。
--
-- 语义说明（通知类的坑）：
--   原实现 WHERE user_id = p_user_id，而 p_user_id 是调用方传进来的参数，
--   意味着任何登录用户传别人的 user_id 就能删/改别人的通知。
--   改为同时要求 p_user_id = auth.uid()（内部员工例外）。
--
-- 实测（partner02，role=partner）：
--   get_partner_balance(别人的 partner_id) → 403 无权查看该合作方余额
--   get_partner_balance(自己的 partner_id) → 200 {success:true,balance:0.00}
--   delete_notification(别人的 user_id)    → 403 无权删除他人通知
--   mark_all_notifications_as_read(别人的) → 403
-- 实测（admin）：
--   get_partner_balance(别人的 partner_id) → 200 {balance:-114694.68}（未被误伤）
--
-- 执行状态：已于 2026-11-27 在生产库执行，本文件归档
-- ============================================================================

-- ============================================================================
-- 第 1 段：通知类
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_notification(p_notification_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $f$
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_internal_user() THEN
        RAISE EXCEPTION '无权删除他人通知' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.notifications
    WHERE id = p_notification_id AND user_id = p_user_id;
END
$f$;

CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $f$
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_internal_user() THEN
        RAISE EXCEPTION '无权限修改他人通知' USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
    SET is_read = true, read_at = now()
    WHERE id = p_notification_id AND user_id = p_user_id;
END
$f$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $f$
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_internal_user() THEN
        RAISE EXCEPTION '无权限批量修改他人通知' USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
    SET is_read = true, read_at = now()
    WHERE user_id = p_user_id AND is_read = false;
END
$f$;

-- ============================================================================
-- 第 2 段：余额查询（越权读）
--   原来任何登录用户传任意 partner_id 都能查。
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_partner_balance(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $f$
DECLARE
    v_balance numeric(15,2) := 0;
BEGIN
    IF NOT (public.is_internal_user() OR p_partner_id = public.get_current_partner_id()) THEN
        RAISE EXCEPTION '无权查看该合作方余额' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.partner_balance (partner_id, balance, updated_at)
    VALUES (p_partner_id, 0, NOW())
    ON CONFLICT (partner_id) DO NOTHING;

    SELECT balance INTO v_balance
    FROM public.partner_balance
    WHERE partner_id = p_partner_id;

    RETURN jsonb_build_object('success', true, 'balance', COALESCE(v_balance, 0));
END
$f$;

-- ============================================================================
-- 第 3 段：地点字典 / 地理编码（overlay 注入，不改原逻辑）
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
BEGIN
    FOR r IN
        SELECT DISTINCT p.proname
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f'
          AND p.proname IN ('get_or_create_locations_from_string', 'update_location_geocoding')
    LOOP
        SELECT pg_get_functiondef(p.oid) INTO v_def
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.proname
        LIMIT 1;

        IF v_def ~ 'has_function_permission' THEN
            CONTINUE;
        END IF;

        v_key := CASE r.proname
            WHEN 'get_or_create_locations_from_string' THEN 'data.create'
            WHEN 'update_location_geocoding' THEN 'data.edit'
        END;

        v_pos := position('$function$' in v_def);
        v_beg := position('BEGIN' in substring(v_def from v_pos + 10));

        v_chk := E'\n  IF NOT public.has_function_permission(''' || v_key || ''') THEN\n'
              || E'    RAISE EXCEPTION ''权限不足：需要 ' || v_key || ' 权限'' USING ERRCODE = ''42501'';\n'
              || E'  END IF;\n';

        v_new := overlay(v_def placing v_chk from (v_pos + 10 + v_beg - 1 + 5) for 0);

        BEGIN
            EXECUTE v_new;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '注入失败 %: %', r.proname, SQLERRM;
        END;
    END LOOP;
END
$inj$;

-- ============================================================================
-- 第 4 段：归档废弃件（函数名含中文破折号，无法正常 RPC 调用）
-- ============================================================================
DO $a$
BEGIN
    EXECUTE 'ALTER FUNCTION public."batch_import_logistics_records—buneng"(jsonb) SET SCHEMA archive';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '归档失败: %', SQLERRM;
END
$a$;

-- ============================================================================
-- 第 5 段：reject_dispatch_order —— 无需改动
--   函数体内已有：
--       v_driver_id := get_current_driver_id();
--       IF v_driver_id IS NULL THEN RETURN ...'未找到司机档案'
--       UPDATE dispatch_orders ... WHERE id = p_order_id AND driver_id = v_driver_id
--   即只能拒绝派给自己的单，已具备身份范围限制，不需要额外角色校验。
-- ============================================================================

-- ============================================================================
-- 第 6 段：只读校验
-- ============================================================================
SELECT p.proname,
       (p.prosrc ~ '42501') AS has_deny,
       (p.prosrc ~ 'has_function_permission') AS has_perm_check,
       n.nspname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN (
    'delete_notification','mark_notification_as_read','mark_all_notifications_as_read',
    'get_partner_balance','get_or_create_locations_from_string','update_location_geocoding'
  )
  OR p.proname LIKE '%buneng%'
ORDER BY 1;

-- ============================================================================
-- 回滚：git 历史或 archive 恢复
--   ALTER FUNCTION archive."batch_import_logistics_records—buneng"(jsonb) SET SCHEMA public;
-- ============================================================================
