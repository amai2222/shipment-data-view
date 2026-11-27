-- ============================================================================
-- 合作方（partner 角色）自助查询 RPC 组
-- 文件: supabase/migrations/20261127_05_partner_rpc.sql
-- ============================================================================
-- 设计原则:
--   1. 全部 SECURITY DEFINER，且强制 SET search_path = public，避免 search_path 注入
--   2. 只对合作方账号开放：内部账号（admin/finance/business/operator/viewer/
--      fleet_manager/driver）调用一律 42501 拒绝
--   3. 数据范围只来自 get_visible_partner_ids()，不接受前端传入的 partner_id，
--      从根本上杜绝「改个参数越权查别家」的问题
--   4. 金额字段一律 numeric 输出；不返回 base_amount / unit_price /
--      其他层级金额 / logistics_records.payable_cost
--
-- 前置依赖（由 A 组迁移 20261127_01 ~ 20261127_04 提供，本文件不重复创建）:
--   public.user_partners(user_id, partner_id, relation, is_primary)
--   public.get_current_partner_id()   RETURNS uuid
--   public.get_visible_partner_ids()  RETURNS uuid[]
--   public.is_internal_user()         RETURNS boolean
--   （若依赖缺失，本文件会在创建时因函数不存在而报错，属于预期失败）
--
-- 本文件不修改任何现有 RPC、不修改任何现有表结构。
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. partner_get_overview()
--    合作方首页概览：主体信息 + 运单/金额统计 + 数据范围 + 是否可看余额
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_get_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id        uuid;
  v_partner_ids       uuid[];
  v_scope             text;
  v_partner           jsonb;
  v_stats             jsonb;
  v_can_view_balance  boolean;
BEGIN
  -- ===== 统一鉴权头（禁止内部账号、禁止未绑定合作方） =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id  := public.get_current_partner_id();
  -- 可见范围只由后端函数决定（前端无法传入 partner_id）；异常空集合时回退到本方
  v_partner_ids := public.get_visible_partner_ids();
  IF COALESCE(array_length(v_partner_ids, 1), 0) = 0 THEN
    v_partner_ids := ARRAY[v_partner_id];
  END IF;
  -- 业务口径（2026-11-27 明确）：分包商与货主一律只看自己，不做上下级穿透
  v_scope := 'self';

  SELECT jsonb_build_object(
           'id',           p.id,
           'name',         COALESCE(p.name, ''),
           'partner_type', COALESCE(p.partner_type::text, ''),
           'tax_rate',     COALESCE(p.tax_rate, 0)::numeric
         )
    INTO v_partner
  FROM public.partners p
  WHERE p.id = v_partner_id;

  SELECT jsonb_build_object(
           'waybill_count', COALESCE(COUNT(DISTINCT lpc.logistics_record_id), 0)::int,
           'unpaid_amount', COALESCE(SUM(lpc.payable_amount) FILTER (
                              WHERE lpc.payment_status IS DISTINCT FROM 'Paid'), 0)::numeric,
           'paid_amount',   COALESCE(SUM(lpc.payable_amount) FILTER (
                              WHERE lpc.payment_status = 'Paid'), 0)::numeric,
           'month_amount',  COALESCE(SUM(lpc.payable_amount) FILTER (
                              WHERE to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM')
                                  = to_char((now() AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM')), 0)::numeric
         )
    INTO v_stats
  FROM public.logistics_partner_costs lpc
  JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
  WHERE lpc.partner_id = ANY (v_partner_ids);

  -- 只有在本方（主合作方）存在余额账户时才允许前端展示余额入口
  SELECT EXISTS (
           SELECT 1 FROM public.partner_balance pb WHERE pb.partner_id = v_partner_id
         )
    INTO v_can_view_balance;

  RETURN jsonb_build_object(
           'partner',         COALESCE(v_partner, '{}'::jsonb),
           'stats',           COALESCE(v_stats, '{}'::jsonb),
           'scope',           v_scope,
           'can_view_balance', v_can_view_balance
         );
END;
$$;

COMMENT ON FUNCTION public.partner_get_overview() IS
  '合作方首页概览（仅 partner 角色；金额为 numeric）';

REVOKE ALL ON FUNCTION public.partner_get_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_overview() TO authenticated;


-- ============================================================================
-- 2. partner_get_waybills()
--    合作方运单分页列表（脱敏：不含 base_amount / unit_price / payable_cost）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_get_waybills(
  p_from    date DEFAULT NULL,
  p_to      date DEFAULT NULL,
  p_page    int  DEFAULT 1,
  p_size    int  DEFAULT 20,
  p_keyword text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id   uuid;
  v_partner_ids  uuid[];
  v_page         int;
  v_size         int;
  v_offset       int;
  v_keyword      text;
  v_rows         jsonb;
  v_total        int;
BEGIN
  -- ===== 统一鉴权头 =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id  := public.get_current_partner_id();
  -- 可见范围只由后端函数决定（前端无法传入 partner_id）；异常空集合时回退到本方
  v_partner_ids := public.get_visible_partner_ids();
  IF COALESCE(array_length(v_partner_ids, 1), 0) = 0 THEN
    v_partner_ids := ARRAY[v_partner_id];
  END IF;

  -- 分页参数保护：页码 >= 1，每页 1~200，防止被用来拉全库
  v_page    := GREATEST(COALESCE(p_page, 1), 1);
  v_size    := LEAST(GREATEST(COALESCE(p_size, 20), 1), 200);
  v_offset  := (v_page - 1) * v_size;
  v_keyword := NULLIF(btrim(COALESCE(p_keyword, '')), '');

  SELECT
    COALESCE(
      jsonb_agg(to_jsonb(f) - 'total_count' ORDER BY f.loading_date DESC NULLS LAST, f.auto_number DESC),
      '[]'::jsonb
    ),
    COALESCE(MAX(f.total_count), 0)::int
  INTO v_rows, v_total
  FROM (
    SELECT
      lpc.id                        AS cost_id,
      lpc.logistics_record_id       AS record_id,
      l.auto_number                 AS auto_number,
      COALESCE(l.project_name, '')  AS project_name,
      to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS loading_date,
      COALESCE(l.loading_location, '')      AS loading_location,
      COALESCE(l.unloading_location, '')    AS unloading_location,
      COALESCE(l.license_plate, '')         AS license_plate,
      l.effective_quantity                  AS effective_quantity,
      l.billing_type_id                     AS billing_type_id,
      lpc.payable_amount                    AS payable_amount,
      COALESCE(lpc.payment_status, l.payment_status)   AS payment_status,
      COALESCE(lpc.invoice_status, l.invoice_status)   AS invoice_status,
      lpc.reconciliation_status             AS reconciliation_status,
      to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') AS bill_month,
      COUNT(*) OVER ()                      AS total_count
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    WHERE lpc.partner_id = ANY (v_partner_ids)
      AND (p_from IS NULL OR DATE(l.loading_date AT TIME ZONE 'Asia/Shanghai') >= p_from)
      AND (p_to   IS NULL OR DATE(l.loading_date AT TIME ZONE 'Asia/Shanghai') <= p_to)
      AND (
            v_keyword IS NULL
         OR l.auto_number    ILIKE '%' || v_keyword || '%'
         OR l.license_plate  ILIKE '%' || v_keyword || '%'
         OR l.project_name   ILIKE '%' || v_keyword || '%'
          )
    ORDER BY l.loading_date DESC NULLS LAST, l.auto_number DESC
    LIMIT v_size OFFSET v_offset
  ) f;

  RETURN jsonb_build_object(
           'rows',  COALESCE(v_rows, '[]'::jsonb),
           'total', COALESCE(v_total, 0)
         );
END;
$$;

COMMENT ON FUNCTION public.partner_get_waybills(date, date, int, int, text) IS
  '合作方运单分页列表（仅 partner 角色；不返回本层以外的任何金额字段）';

REVOKE ALL ON FUNCTION public.partner_get_waybills(date, date, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_waybills(date, date, int, int, text) TO authenticated;


-- ============================================================================
-- 3. partner_get_statement()
--    月度对账单：按项目汇总 + 按支付状态汇总
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_get_statement(
  p_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id   uuid;
  v_partner_ids  uuid[];
  v_month        text;
  v_groups       jsonb;
  v_by_status    jsonb;
  v_total        numeric;
  v_paid         numeric;
  v_unpaid       numeric;
BEGIN
  -- ===== 统一鉴权头 =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id  := public.get_current_partner_id();
  -- 可见范围只由后端函数决定（前端无法传入 partner_id）；异常空集合时回退到本方
  v_partner_ids := public.get_visible_partner_ids();
  IF COALESCE(array_length(v_partner_ids, 1), 0) = 0 THEN
    v_partner_ids := ARRAY[v_partner_id];
  END IF;

  v_month := COALESCE(NULLIF(btrim(COALESCE(p_month, '')), ''), to_char((now() AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM'));
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION '月份格式错误，应为 YYYY-MM，例如 2026-11' USING ERRCODE = '22007';
  END IF;

  -- 按项目汇总
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'project_name', g.project_name,
               'count',        g.cnt,
               'amount',       g.amount
             ) ORDER BY g.amount DESC, g.project_name
           ),
           '[]'::jsonb
         )
    INTO v_groups
  FROM (
    SELECT
      COALESCE(NULLIF(l.project_name, ''), '未分类') AS project_name,
      COUNT(*)::int                                  AS cnt,
      COALESCE(SUM(lpc.payable_amount), 0)::numeric   AS amount
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    WHERE lpc.partner_id = ANY (v_partner_ids)
      AND to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = v_month
    GROUP BY 1
  ) g;

  -- 按支付状态汇总
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'status', s.status,
               'count',  s.cnt,
               'amount', s.amount
             ) ORDER BY s.amount DESC, s.status
           ),
           '[]'::jsonb
         )
    INTO v_by_status
  FROM (
    SELECT
      COALESCE(NULLIF(lpc.payment_status, ''), 'Unpaid') AS status,
      COUNT(*)::int                                      AS cnt,
      COALESCE(SUM(lpc.payable_amount), 0)::numeric       AS amount
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    WHERE lpc.partner_id = ANY (v_partner_ids)
      AND to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = v_month
    GROUP BY 1
  ) s;

  SELECT
    COALESCE(SUM(lpc.payable_amount), 0)::numeric,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.payment_status = 'Paid'), 0)::numeric,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.payment_status IS DISTINCT FROM 'Paid'), 0)::numeric
  INTO v_total, v_paid, v_unpaid
  FROM public.logistics_partner_costs lpc
  JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
  WHERE lpc.partner_id = ANY (v_partner_ids)
    AND to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = v_month;

  RETURN jsonb_build_object(
           'month',        v_month,
           'groups',       COALESCE(v_groups, '[]'::jsonb),
           'total_amount', v_total,
           'paid_amount',  v_paid,
           'unpaid_amount', v_unpaid,
           'by_status',    COALESCE(v_by_status, '[]'::jsonb)
         );
END;
$$;

COMMENT ON FUNCTION public.partner_get_statement(text) IS
  '合作方月度对账单（p_month 为 YYYY-MM，NULL 取当前月）';

REVOKE ALL ON FUNCTION public.partner_get_statement(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_statement(text) TO authenticated;


-- ============================================================================
-- 4. partner_get_trend()
--    近 N 个月金额/票数趋势，升序，缺月补 0
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_get_trend(
  p_months int DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id   uuid;
  v_partner_ids  uuid[];
  v_months       int;
  v_start        date;
  v_rows         jsonb;
BEGIN
  -- ===== 统一鉴权头 =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id  := public.get_current_partner_id();
  -- 可见范围只由后端函数决定（前端无法传入 partner_id）；异常空集合时回退到本方
  v_partner_ids := public.get_visible_partner_ids();
  IF COALESCE(array_length(v_partner_ids, 1), 0) = 0 THEN
    v_partner_ids := ARRAY[v_partner_id];
  END IF;

  -- 只允许 1~24 个月，防止被用来做全量扫描
  v_months := LEAST(GREATEST(COALESCE(p_months, 6), 1), 24);
  v_start  := (date_trunc('month', (now() AT TIME ZONE 'Asia/Shanghai')::date)
               - ((v_months - 1) || ' month')::interval)::date;

  WITH m AS (
    SELECT gs::date AS month_start
    FROM generate_series(
           date_trunc('month', (now() AT TIME ZONE 'Asia/Shanghai')::date) - ((v_months - 1) || ' month')::interval,
           date_trunc('month', (now() AT TIME ZONE 'Asia/Shanghai')::date),
           interval '1 month'
         ) AS gs
  ),
  agg AS (
    SELECT
      date_trunc('month', l.loading_date AT TIME ZONE 'Asia/Shanghai')::date AS month_start,
      COUNT(DISTINCT lpc.logistics_record_id)::int AS cnt,
      COALESCE(SUM(lpc.payable_amount), 0)::numeric AS amount
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    WHERE lpc.partner_id = ANY (v_partner_ids)
      AND DATE(l.loading_date AT TIME ZONE 'Asia/Shanghai') >= v_start
    GROUP BY 1
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'month',  to_char(m.month_start, 'YYYY-MM'),
               'amount', COALESCE(a.amount, 0)::numeric,
               'count',  COALESCE(a.cnt, 0)
             ) ORDER BY m.month_start
           ),
           '[]'::jsonb
         )
    INTO v_rows
  FROM m
  LEFT JOIN agg a ON a.month_start = m.month_start;

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

COMMENT ON FUNCTION public.partner_get_trend(int) IS
  '合作方近 N 个月结算趋势（升序，缺月补 0，N 限 1~24）';

REVOKE ALL ON FUNCTION public.partner_get_trend(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_trend(int) TO authenticated;


-- ============================================================================
-- 5. partner_get_reconciliation()
--    月度对账明细
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_get_reconciliation(
  p_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id        uuid;
  v_partner_ids       uuid[];
  v_month             text;
  v_rows              jsonb;
  v_total             int;
  v_unrec_count       int;
  v_unrec_amount      numeric;
BEGIN
  -- ===== 统一鉴权头 =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id  := public.get_current_partner_id();
  -- 可见范围只由后端函数决定（前端无法传入 partner_id）；异常空集合时回退到本方
  v_partner_ids := public.get_visible_partner_ids();
  IF COALESCE(array_length(v_partner_ids, 1), 0) = 0 THEN
    v_partner_ids := ARRAY[v_partner_id];
  END IF;

  v_month := COALESCE(NULLIF(btrim(COALESCE(p_month, '')), ''), to_char((now() AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM'));
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION '月份格式错误，应为 YYYY-MM，例如 2026-11' USING ERRCODE = '22007';
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             to_jsonb(t)
             ORDER BY t.loading_date DESC NULLS LAST, t.auto_number DESC
           ),
           '[]'::jsonb
         ),
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE t.reconciliation_status IS DISTINCT FROM 'Reconciled')::int,
         COALESCE(SUM(t.payable_amount) FILTER (
           WHERE t.reconciliation_status IS DISTINCT FROM 'Reconciled'), 0)::numeric
    INTO v_rows, v_total, v_unrec_count, v_unrec_amount
  FROM (
    SELECT
      lpc.id                     AS cost_id,
      l.auto_number              AS auto_number,
      to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS loading_date,
      lpc.payable_amount         AS payable_amount,
      lpc.reconciliation_status  AS reconciliation_status,
      lpc.reconciliation_notes   AS reconciliation_notes
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    WHERE lpc.partner_id = ANY (v_partner_ids)
      AND to_char(l.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = v_month
  ) t;

  RETURN jsonb_build_object(
           'rows',               COALESCE(v_rows, '[]'::jsonb),
           'total',              COALESCE(v_total, 0),
           'unreconciled_count', COALESCE(v_unrec_count, 0),
           'unreconciled_amount', COALESCE(v_unrec_amount, 0)
         );
END;
$$;

COMMENT ON FUNCTION public.partner_get_reconciliation(text) IS
  '合作方月度对账明细（p_month 为 YYYY-MM，NULL 取当前月）';

REVOKE ALL ON FUNCTION public.partner_get_reconciliation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_reconciliation(text) TO authenticated;


-- ============================================================================
-- 6. partner_confirm_reconciliation()
--    合作方确认对账：只允许写 reconciliation_* 四个字段
--    逐条校验归属（partner_id 必须 ∈ get_visible_partner_ids()），越权条目计入 skipped
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_confirm_reconciliation(
  p_cost_ids uuid[],
  p_note     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id   uuid;
  v_partner_ids  uuid[];
  v_ids          uuid[];
  v_requested    int;
  v_updated      int := 0;
  v_note         text;
BEGIN
  -- ===== 统一鉴权头 =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id  := public.get_current_partner_id();
  -- 可见范围只由后端函数决定（前端无法传入 partner_id）；异常空集合时回退到本方
  v_partner_ids := public.get_visible_partner_ids();
  IF COALESCE(array_length(v_partner_ids, 1), 0) = 0 THEN
    v_partner_ids := ARRAY[v_partner_id];
  END IF;

  IF p_cost_ids IS NULL OR COALESCE(array_length(p_cost_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION '请选择需要确认对账的成本记录' USING ERRCODE = '22023';
  END IF;

  -- 去重 + 去 NULL，避免重复 ID 放大 updated 计数
  v_ids := ARRAY(
    SELECT DISTINCT u
    FROM unnest(p_cost_ids) AS u
    WHERE u IS NOT NULL
  );
  v_requested := COALESCE(array_length(v_ids, 1), 0);

  IF v_requested = 0 THEN
    RAISE EXCEPTION '请选择需要确认对账的成本记录' USING ERRCODE = '22023';
  END IF;

  IF v_requested > 1000 THEN
    RAISE EXCEPTION '单次最多确认 1000 条记录，请分批提交' USING ERRCODE = '22023';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION '对账备注不能超过 500 个字符' USING ERRCODE = '22001';
  END IF;

  -- 核心防线：WHERE 里同时限定归属范围，跨合作方的 ID 天然不会被命中，只会进 skipped
  UPDATE public.logistics_partner_costs lpc
     SET reconciliation_status = 'Reconciled',
         reconciliation_notes  = COALESCE(v_note, lpc.reconciliation_notes),
         reconciliation_date   = now(),
         reconciliation_by     = auth.uid()
   WHERE lpc.id = ANY (v_ids)
     AND lpc.partner_id = ANY (v_partner_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
           'updated', v_updated,
           'skipped', GREATEST(v_requested - v_updated, 0)
         );
END;
$$;

COMMENT ON FUNCTION public.partner_confirm_reconciliation(uuid[], text) IS
  '合作方确认对账（仅写 reconciliation_status/notes/date/by；越权记录自动 skipped）';

REVOKE ALL ON FUNCTION public.partner_confirm_reconciliation(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_confirm_reconciliation(uuid[], text) TO authenticated;


-- ============================================================================
-- 7. partner_get_profile()
--    合作方主体信息 + 开票资料（开户行）+ 当前账号
-- ============================================================================
CREATE OR REPLACE FUNCTION public.partner_get_profile()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id  uuid;
  v_result      jsonb;
BEGIN
  -- ===== 统一鉴权头 =====
  IF public.is_internal_user() THEN
    RAISE EXCEPTION '该接口仅对合作方账号开放' USING ERRCODE = '42501';
  END IF;

  IF public.get_current_partner_id() IS NULL THEN
    RAISE EXCEPTION '当前账号未绑定合作方，请联系管理员' USING ERRCODE = '42501';
  END IF;

  v_partner_id := public.get_current_partner_id();

  SELECT jsonb_build_object(
           'partner', jsonb_build_object(
             'id',         p.id,
             'name',       COALESCE(p.name, ''),
             'full_name',  COALESCE(NULLIF(p.full_name, ''), b.full_name),
             'tax_number', b.tax_number
           ),
           'bank', jsonb_build_object(
             'bank_name',    b.bank_name,
             'bank_account', b.bank_account,
             'branch_name',  b.branch_name
           ),
           'user', jsonb_build_object(
             'email',     pr.email,
             'full_name', pr.full_name
           )
         )
    INTO v_result
  FROM public.partners p
  LEFT JOIN public.partner_bank_details b ON b.partner_id = p.id
  LEFT JOIN public.profiles pr ON pr.id = auth.uid()
  WHERE p.id = v_partner_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION '未找到合作方档案，请联系管理员' USING ERRCODE = '42501';
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.partner_get_profile() IS
  '合作方档案（主体信息 + 开户行 + 当前账号）';

REVOKE ALL ON FUNCTION public.partner_get_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_get_profile() TO authenticated;


-- ============================================================================
-- 自检：确认 7 个函数存在
-- ============================================================================
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(fn, ', ')
    INTO v_missing
  FROM unnest(ARRAY[
         'partner_get_overview',
         'partner_get_waybills',
         'partner_get_statement',
         'partner_get_trend',
         'partner_get_reconciliation',
         'partner_confirm_reconciliation',
         'partner_get_profile'
       ]) AS fn
  WHERE NOT EXISTS (
          SELECT 1 FROM pg_proc
          WHERE pronamespace = 'public'::regnamespace
            AND proname = fn
        );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '以下合作方 RPC 创建失败: %', v_missing;
  END IF;

  RAISE NOTICE '✅ 合作方 RPC 组创建完成（7 个函数，仅 authenticated 可执行）';
END $$;

COMMIT;
