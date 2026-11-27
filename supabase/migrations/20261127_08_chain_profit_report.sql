-- ============================================================================
-- 链路毛利 / 链路结构 / 应收账龄 三张只读报表 RPC
-- 文件: supabase/migrations/20261127_08_chain_profit_report.sql
-- ============================================================================
-- 【只读声明】
--   本文件不含任何 DML/DDL 语句作用于业务数据：
--     · 无 INSERT / UPDATE / DELETE / TRUNCATE / MERGE
--     · 无 ALTER TABLE 业务表、无 CREATE INDEX、无数据回填
--     · 仅 CREATE OR REPLACE FUNCTION + COMMENT + REVOKE/GRANT
--   因此本文件不会改变、修正或重算任何现有金额字段
--   （logistics_records.payable_cost / logistics_partner_costs.payable_amount 等），
--   也不会影响任何现有 RPC 的行为。
--
-- 【口径（业务已确认 2026-11-27）】
--   链路 = 运单(logistics_records.chain_id)
--        → 分层配置(project_partners.level)
--        → 每层金额(logistics_partner_costs.payable_amount)
--   · level = MAX(level) 的行  → 中科应收（货主付给中科）
--   · level < MAX(level) 的行  → 中科应付（中科付给分包商）
--   · 中科毛利 = 最高层金额合计 − 其余层金额合计
--   · 全层共用同一个基数（运单 payable_cost），不做逐层级联
--
-- 【依赖】
--   public.is_internal_user()  见 20261127_02_user_partners.sql
--   partner_chains.owner_partner_id  由 G1 迁移新增；本文件通过
--   to_jsonb(pc) ->> 'owner_partner_id' 读取，列不存在时自动得到 NULL，
--   不会因列尚未上线而创建失败。
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. get_chain_profit_report
--    链路毛利报表：汇总 + 按链路 + 按月
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_chain_profit_report(
  p_from       date DEFAULT NULL,
  p_to         date DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary  jsonb;
  v_by_chain jsonb;
  v_by_month jsonb;
BEGIN
  -- ===== 统一鉴权头：仅内部账号 =====
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION '该报表仅内部账号可访问' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    -- 过滤后的运单（loading_date 为 timestamptz，统一换算到 Asia/Shanghai 的日历日）
    SELECT
      l.id,
      l.chain_id,
      l.project_id,
      l.loading_date
    FROM public.logistics_records l
    WHERE l.chain_id IS NOT NULL
      AND (p_from IS NULL
           OR (l.loading_date AT TIME ZONE 'Asia/Shanghai')::date >= p_from)
      AND (p_to IS NULL
           OR (l.loading_date AT TIME ZONE 'Asia/Shanghai')::date <= p_to)
      AND (p_project_id IS NULL OR l.project_id = p_project_id)
  ),
  rec_level AS (
    -- 每个运单自己的最高层级（先算 max，避免后续重复计数）
    SELECT
      lpc.logistics_record_id,
      MAX(lpc.level) AS max_level
    FROM public.logistics_partner_costs lpc
    JOIN base b ON b.id = lpc.logistics_record_id
    GROUP BY lpc.logistics_record_id
  ),
  rec AS (
    -- 单运单口径：revenue = 最高层金额，cost = 其余层金额之和
    SELECT
      b.id,
      b.chain_id,
      b.project_id,
      b.loading_date,
      COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.level =  rl.max_level), 0)::numeric AS revenue,
      COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.level <  rl.max_level), 0)::numeric AS cost
    FROM base b
    JOIN rec_level rl              ON rl.logistics_record_id = b.id
    JOIN public.logistics_partner_costs lpc ON lpc.logistics_record_id = b.id
    GROUP BY b.id, b.chain_id, b.project_id, b.loading_date
  ),
  chain_rows AS (
    SELECT
      r.chain_id,
      COALESCE(pc.chain_name, '')                AS chain_name,
      COALESCE(r.project_id, pc.project_id)      AS project_id,
      COALESCE(pj.name, '')                      AS project_name,
      po.name                                    AS owner_name,
      SUM(r.revenue)                             AS revenue,
      SUM(r.cost)                                AS cost,
      COUNT(*)::int                              AS waybill_count
    FROM rec r
    LEFT JOIN public.partner_chains pc ON pc.id = r.chain_id
    LEFT JOIN public.projects pj       ON pj.id = COALESCE(r.project_id, pc.project_id)
    -- owner_partner_id 由 G1 新增；列不存在时 (to_jsonb(pc)->>'owner_partner_id') 为 NULL
    LEFT JOIN public.partners po       ON po.id = (to_jsonb(pc) ->> 'owner_partner_id')::uuid
    GROUP BY r.chain_id, pc.chain_name, COALESCE(r.project_id, pc.project_id), pj.name, po.name
  ),
  month_rows AS (
    SELECT
      to_char(r.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') AS month,
      SUM(r.revenue) AS revenue,
      SUM(r.cost)    AS cost
    FROM rec r
    GROUP BY 1
  )
  SELECT
    -- ---- summary ----
    jsonb_build_object(
      'revenue',       ROUND(COALESCE(s.revenue, 0), 2),
      'cost',          ROUND(COALESCE(s.cost, 0), 2),
      'gross',         ROUND(COALESCE(s.revenue, 0) - COALESCE(s.cost, 0), 2),
      'margin_rate',   ROUND((COALESCE(s.revenue, 0) - COALESCE(s.cost, 0))
                             / NULLIF(s.revenue, 0) * 100, 2),
      'waybill_count', COALESCE(s.waybill_count, 0),
      'chain_count',   COALESCE(s.chain_count, 0)
    ),
    -- ---- by_chain（按 revenue desc）----
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'chain_id',      c.chain_id,
                  'chain_name',    c.chain_name,
                  'project_id',    c.project_id,
                  'project_name',  c.project_name,
                  'owner_name',    c.owner_name,
                  'revenue',       ROUND(c.revenue, 2),
                  'cost',          ROUND(c.cost, 2),
                  'gross',         ROUND(c.revenue - c.cost, 2),
                  'margin_rate',   ROUND((c.revenue - c.cost) / NULLIF(c.revenue, 0) * 100, 2),
                  'waybill_count', c.waybill_count
                )
                ORDER BY c.revenue DESC, c.chain_id
              )
       FROM chain_rows c),
      '[]'::jsonb
    ),
    -- ---- by_month ----
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'month',   m.month,
                  'revenue', ROUND(m.revenue, 2),
                  'cost',    ROUND(m.cost, 2),
                  'gross',   ROUND(m.revenue - m.cost, 2)
                )
                ORDER BY m.month
              )
       FROM month_rows m),
      '[]'::jsonb
    )
  INTO v_summary, v_by_chain, v_by_month
  FROM (
    SELECT
      COALESCE(SUM(revenue), 0)     AS revenue,
      COALESCE(SUM(cost), 0)        AS cost,
      COUNT(*)::int                 AS waybill_count,
      COUNT(DISTINCT chain_id)::int AS chain_count
    FROM rec
  ) s;

  RETURN jsonb_build_object(
           'summary',  COALESCE(v_summary,  '{}'::jsonb),
           'by_chain', COALESCE(v_by_chain, '[]'::jsonb),
           'by_month', COALESCE(v_by_month, '[]'::jsonb)
         );
END;
$$;

COMMENT ON FUNCTION public.get_chain_profit_report(date, date, uuid) IS
  '链路毛利报表（仅内部账号）：最高层=中科应收，其余层=中科应付；纯 SELECT，不写任何数据';

REVOKE ALL ON FUNCTION public.get_chain_profit_report(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chain_profit_report(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chain_profit_report(date, date, uuid) TO authenticated;


-- ============================================================================
-- 2. get_chain_structure
--    单条链路的分层结构：project_partners 出骨架，logistics_partner_costs 出实际金额
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_chain_structure(p_chain_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chain  jsonb;
  v_layers jsonb;
BEGIN
  -- ===== 统一鉴权头：仅内部账号 =====
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION '该报表仅内部账号可访问' USING ERRCODE = '42501';
  END IF;

  IF p_chain_id IS NULL THEN
    RETURN jsonb_build_object('chain', NULL, 'layers', '[]'::jsonb);
  END IF;

  -- ---- 链路基本信息 ----
  SELECT jsonb_build_object(
           'id',              pc.id,
           'chain_name',      COALESCE(pc.chain_name, ''),
           'project_name',    pj.name,
           'owner_name',      po.name,
           'billing_type_id', pc.billing_type_id,
           'waybill_count',   (SELECT COUNT(*)::int
                               FROM public.logistics_records l
                               WHERE l.chain_id = pc.id)
         )
    INTO v_chain
  FROM public.partner_chains pc
  LEFT JOIN public.projects pj ON pj.id = pc.project_id
  -- owner_partner_id 由 G1 新增；列不存在时为 NULL
  LEFT JOIN public.partners po ON po.id = (to_jsonb(pc) ->> 'owner_partner_id')::uuid
  WHERE pc.id = p_chain_id;

  IF v_chain IS NULL THEN
    RETURN jsonb_build_object('chain', NULL, 'layers', '[]'::jsonb);
  END IF;

  -- ---- 层级明细 ----
  WITH skeleton AS (
    -- 骨架来自 project_partners；同一 level 若配了多个合作方，取最近更新的一条做代表
    SELECT DISTINCT ON (pp.level)
           pp.level,
           pp.partner_id,
           pp.calculation_method,
           pp.tax_rate,
           pp.profit_rate,
           pp.unit_price
    FROM public.project_partners pp
    WHERE pp.chain_id = p_chain_id
    ORDER BY pp.level, pp.updated_at DESC NULLS LAST, pp.created_at DESC
  ),
  actual AS (
    -- 该链路下所有运单的层级实际金额
    SELECT
      lpc.level,
      COUNT(DISTINCT lpc.logistics_record_id)::int AS waybill_count,
      SUM(lpc.payable_amount)::numeric             AS total_payable
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    WHERE l.chain_id = p_chain_id
    GROUP BY lpc.level
  ),
  merged AS (
    -- FULL JOIN：既保留「配了层但没金额」的层，也暴露「有金额但没配置」的孤儿层
    SELECT
      COALESCE(s.level, a.level)                        AS level,
      s.partner_id,
      s.calculation_method,
      s.tax_rate,
      s.profit_rate,
      s.unit_price,
      COALESCE(a.waybill_count, 0)                      AS waybill_count,
      ROUND(COALESCE(a.total_payable, 0), 2)            AS total_payable
    FROM skeleton s
    FULL OUTER JOIN actual a ON a.level = s.level
  ),
  top AS (
    -- 最高层 = 中科应收，其金额作为 share 的分母
    SELECT level, total_payable
    FROM merged
    ORDER BY level DESC
    LIMIT 1
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'level',              m.level,
               'partner_name',       po.name,
               'partner_type',       po.partner_type::text,
               'calculation_method', m.calculation_method,
               'tax_rate',           m.tax_rate,
               'profit_rate',        m.profit_rate,
               'unit_price',         m.unit_price,
               'waybill_count',      m.waybill_count,
               'total_payable',      m.total_payable,
               'share',              ROUND(m.total_payable / NULLIF(t.total_payable, 0), 4),
               'kind',               CASE WHEN m.level = t.level THEN 'receivable' ELSE 'payable' END
             )
             ORDER BY m.level
           ),
           '[]'::jsonb
         )
    INTO v_layers
  FROM merged m
  CROSS JOIN top t
  LEFT JOIN public.partners po ON po.id = m.partner_id;

  RETURN jsonb_build_object(
           'chain',  v_chain,
           'layers', COALESCE(v_layers, '[]'::jsonb)
         );
END;
$$;

COMMENT ON FUNCTION public.get_chain_structure(uuid) IS
  '单条链路分层结构（仅内部账号）：level=max 标 receivable，其余标 payable；纯 SELECT';

REVOKE ALL ON FUNCTION public.get_chain_structure(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chain_structure(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chain_structure(uuid) TO authenticated;


-- ============================================================================
-- 3. get_receivable_aging
--    中科应收账龄（level = 该运单最高层，且未付款）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_receivable_aging(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of        date;
  v_buckets      jsonb;
  v_total_count  int;
  v_total_amount numeric;
BEGIN
  -- ===== 统一鉴权头：仅内部账号 =====
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION '该报表仅内部账号可访问' USING ERRCODE = '42501';
  END IF;

  v_as_of := COALESCE(p_as_of, current_date);

  WITH rec_level AS (
    SELECT
      lpc.logistics_record_id,
      MAX(lpc.level) AS max_level
    FROM public.logistics_partner_costs lpc
    GROUP BY lpc.logistics_record_id
  ),
  rec AS (
    SELECT
      lpc.id,
      lpc.payable_amount,
      -- 账龄天数：基准日 − 装货日（上海时区日历日）；未来单据按 0 天处理
      GREATEST(
        v_as_of - (l.loading_date AT TIME ZONE 'Asia/Shanghai')::date,
        0
      ) AS age_days
    FROM public.logistics_partner_costs lpc
    JOIN public.logistics_records l ON l.id = lpc.logistics_record_id
    JOIN rec_level rl              ON rl.logistics_record_id = lpc.logistics_record_id
    WHERE lpc.level = rl.max_level                 -- 只取最高层（中科应收）
      AND lpc.payment_status IS DISTINCT FROM 'Paid'  -- 未付款（含 NULL）
  ),
  bucketed AS (
    SELECT
      CASE
        WHEN age_days <= 30 THEN '0-30'
        WHEN age_days <= 60 THEN '31-60'
        WHEN age_days <= 90 THEN '61-90'
        ELSE '90+'
      END AS bucket,
      payable_amount
    FROM rec
  ),
  buckets AS (
    SELECT b.bucket,
           b.ord,
           COALESCE(COUNT(bk.payable_amount), 0)::int AS cnt,
           COALESCE(SUM(bk.payable_amount), 0)::numeric AS amount
    FROM (VALUES ('0-30', 1), ('31-60', 2), ('61-90', 3), ('90+', 4)) AS b(bucket, ord)
    LEFT JOIN bucketed bk ON bk.bucket = b.bucket
    GROUP BY b.bucket, b.ord
  ),
  totals AS (
    SELECT COALESCE(COUNT(*), 0)::int            AS total_count,
           COALESCE(SUM(payable_amount), 0)::numeric AS total_amount
    FROM rec
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'bucket', x.bucket,
                  'count',  x.cnt,
                  'amount', ROUND(x.amount, 2)
                )
                ORDER BY x.ord
              )
       FROM buckets x),
      '[]'::jsonb
    ),
    t.total_count,
    ROUND(t.total_amount, 2)
  INTO v_buckets, v_total_count, v_total_amount
  FROM totals t;

  RETURN jsonb_build_object(
           'buckets',      COALESCE(v_buckets, '[]'::jsonb),
           'total_count',  COALESCE(v_total_count, 0),
           'total_amount', COALESCE(v_total_amount, 0)
         );
END;
$$;

COMMENT ON FUNCTION public.get_receivable_aging(date) IS
  '中科应收账龄分桶（仅内部账号）：level=max 且 payment_status<>''Paid''；纯 SELECT';

REVOKE ALL ON FUNCTION public.get_receivable_aging(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_receivable_aging(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_receivable_aging(date) TO authenticated;


-- ============================================================================
-- 自检提示（只读，不改数据）
-- ============================================================================
DO $$
DECLARE
  v_missing  text;
  v_all_sec  boolean;
  v_all_stab boolean;
BEGIN
  SELECT string_agg(t.f, ', ')
    INTO v_missing
  FROM (VALUES
          ('public.get_chain_profit_report(date,date,uuid)'),
          ('public.get_chain_structure(uuid)'),
          ('public.get_receivable_aging(date)')
       ) AS t(f)
  WHERE to_regprocedure(t.f) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '以下函数创建失败: %', v_missing;
  END IF;

  SELECT bool_and(p.prosecdef), bool_and(p.provolatile = 's')
    INTO v_all_sec, v_all_stab
  FROM pg_proc p
  WHERE p.oid IN (
    to_regprocedure('public.get_chain_profit_report(date,date,uuid)'),
    to_regprocedure('public.get_chain_structure(uuid)'),
    to_regprocedure('public.get_receivable_aging(date)')
  );

  IF NOT COALESCE(v_all_sec, FALSE) THEN
    RAISE EXCEPTION '报表函数未全部启用 SECURITY DEFINER，已中止';
  END IF;

  IF NOT COALESCE(v_all_stab, FALSE) THEN
    RAISE WARNING '注意：部分报表函数未按 STABLE 创建，请人工确认';
  END IF;

  RAISE NOTICE '✅ 20261127_08_chain_profit_report.sql 完成（3 个只读 RPC，未修改任何数据）';
END $$;

COMMIT;
