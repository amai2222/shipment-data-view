-- ============================================================================
-- 链路归属方字段 + 中科（我司主体）主数据代建 + 归属回填
-- 文件: supabase/migrations/20261127_07_partner_chain_owner.sql
-- ============================================================================
-- 【最高原则】现有运单价格与财务报表已核对准确，本文件：
--   ✗ 不修改任何现有业务数据的值（金额/税率/数量一律不动）
--   ✗ 不重算任何历史数据、不调用任何计费/重算函数
--   ✗ 不修改 logistics_partner_costs / logistics_records（仅只读引用，未出现写操作）
--   ✓ 只做三件事：加字段、代建一条本公司主数据、回填新字段（新字段原本为 NULL）
--
-- 【幂等】可在 Supabase SQL Editor 反复执行：
--   - ADD COLUMN IF NOT EXISTS；FK 存在性检查后再 ADD CONSTRAINT
--   - INSERT 前置 count 检查，已存在则跳过
--   - UPDATE 带 owner_partner_id IS NULL 条件，重跑影响 0 行
--
-- 【失败隔离】不含顶层 BEGIN/COMMIT；每段是独立 DO 块且自带 EXCEPTION 捕获，
--   任何一段失败只输出 NOTICE，后续段落继续执行，不回滚、不连锁。
--   第 4 段是纯 SELECT，可单独选中执行。
--
-- 环境：PostgreSQL 17（ADD COLUMN IF NOT EXISTS 自 9.6 起支持）
-- 执行身份：SQL Editor 默认 postgres，可绕过 RLS；代建主数据即依赖此点。
-- ============================================================================


-- ============================================================================
-- 第 1 段：partner_chains 新增归属方字段 owner_partner_id
--   语义：链路归属方 = 我司主体（默认「中科」），仅用于按我司维度汇总
--        收入 / 成本 / 毛利，不参与任何计价逻辑。
--   ON DELETE SET NULL：删主体不清链路；链路本身数据不受影响。
-- ============================================================================
DO $seg1$
BEGIN
  IF to_regclass('public.partner_chains') IS NULL THEN
    RAISE NOTICE '[第1段] 跳过：表 public.partner_chains 不存在';
    RETURN;
  END IF;

  IF to_regclass('public.partners') IS NULL THEN
    RAISE NOTICE '[第1段] 跳过：表 public.partners 不存在，无法建立外键';
    RETURN;
  END IF;

  -- 1.1 加列（幂等）
  ALTER TABLE public.partner_chains
    ADD COLUMN IF NOT EXISTS owner_partner_id uuid;

  -- 1.2 加外键（约束无 IF NOT EXISTS，先查 pg_constraint）
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_chains_owner_partner_id_fkey'
      AND conrelid = 'public.partner_chains'::regclass
  ) THEN
    ALTER TABLE public.partner_chains
      ADD CONSTRAINT partner_chains_owner_partner_id_fkey
      FOREIGN KEY (owner_partner_id)
      REFERENCES public.partners(id)
      ON DELETE SET NULL;
    RAISE NOTICE '[第1段] 已创建外键 partner_chains_owner_partner_id_fkey';
  ELSE
    RAISE NOTICE '[第1段] 外键已存在，跳过';
  END IF;

  -- 1.3 注释
  COMMENT ON COLUMN public.partner_chains.owner_partner_id IS
    '链路归属方（我司主体），默认中科；用于按我司维度汇总收入/成本/毛利，不参与计价';

  RAISE NOTICE '[第1段] 完成：owner_partner_id 就绪';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[第1段] 失败但不中断：% (SQLSTATE=%)', SQLERRM, SQLSTATE;
END
$seg1$;


-- ============================================================================
-- 第 2 段：代建中科主数据（仅当「本公司」记录不存在时）
--   字段依据 src/integrations/supabase/types.ts 的 partners.Insert：
--     必填 -> name (string), tax_rate (number)
--     可选 -> full_name / partner_type / user_id / parent_partner_id /
--             hierarchy_path / hierarchy_depth / is_root / created_at / updated_at
--   本段只写 name / full_name / tax_rate / partner_type / user_id / parent_partner_id。
--
--   层级三字段（hierarchy_path / hierarchy_depth / is_root）不手写：
--   由 trigger_maintain_partner_hierarchy 维护；该触发器对「非货主」类型
--   （含本公司）会把这三项显式置为 NULL，属既定设计，所以本公司记录上
--   这三个字段为 NULL 是正确状态，不是漏填。
--   仅当触发器不存在时，才对本段刚插入的那一行显式回填（不碰任何历史行）。
-- ============================================================================
DO $seg2$
DECLARE
  v_cnt            integer;
  v_id             uuid;
  v_created        boolean := false;
  v_has_trigger    boolean := false;
  v_has_func_path  boolean := false;
BEGIN
  IF to_regclass('public.partners') IS NULL THEN
    RAISE NOTICE '[第2段] 跳过：表 public.partners 不存在';
    RETURN;
  END IF;

  -- 2.1 统计现有「本公司」记录（不删、不改）
  BEGIN
    SELECT count(*) INTO v_cnt
    FROM public.partners
    WHERE partner_type = '本公司'::public.partner_type_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE NOTICE '[第2段] 枚举 public.partner_type_enum 缺少值「本公司」，请先执行 20250122_add_partner_type_values.sql；本段跳过';
      RETURN;
  END;

  IF v_cnt = 0 THEN
    -- 2.2 不存在则插入（company 主数据，唯一被授权的写操作）
    INSERT INTO public.partners (
      name,
      full_name,
      tax_rate,
      partner_type,
      user_id,
      parent_partner_id
    ) VALUES (
      '中科',
      NULL,
      0.06,
      '本公司'::public.partner_type_enum,
      NULL,
      NULL
    )
    RETURNING id INTO v_id;

    v_created := true;
    RAISE NOTICE '[第2段] 已代建本公司主数据：id=%, name=中科, tax_rate=0.06', v_id;

  ELSIF v_cnt = 1 THEN
    SELECT id INTO v_id
    FROM public.partners
    WHERE partner_type = '本公司'::public.partner_type_enum
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
    RAISE NOTICE '[第2段] 本公司记录已存在（id=%），跳过创建', v_id;

  ELSE
    SELECT id INTO v_id
    FROM public.partners
    WHERE partner_type = '本公司'::public.partner_type_enum
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
    RAISE NOTICE '[第2段] 检测到 % 条本公司记录，回填将取 created_at 最早一条（id=%）；未删除任何记录', v_cnt, v_id;
  END IF;

  -- 2.3 触发器存在性检查
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_maintain_partner_hierarchy'
      AND tgrelid = 'public.partners'::regclass
      AND NOT tgisinternal
  ) INTO v_has_trigger;

  IF v_has_trigger THEN
    RAISE NOTICE '[第2段] 触发器 trigger_maintain_partner_hierarchy 存在，层级字段由触发器维护（本公司为 NULL 属预期）';
    RETURN;
  END IF;

  RAISE NOTICE '[第2段] 未检测到触发器 trigger_maintain_partner_hierarchy';

  -- 2.4 仅对「本段刚插入」的那一行回填，绝不更新任何历史记录
  IF NOT v_created THEN
    RAISE NOTICE '[第2段] 记录为既有数据，按最高原则不回填、不修改其层级字段';
    RETURN;
  END IF;

  SELECT to_regprocedure('public.calculate_hierarchy_path(uuid)') IS NOT NULL
     AND to_regprocedure('public.calculate_hierarchy_depth(uuid)') IS NOT NULL
  INTO v_has_func_path;

  IF NOT v_has_func_path THEN
    RAISE NOTICE '[第2段] calculate_hierarchy_path/depth 函数不存在，跳过层级回填（不影响归属汇总）';
    RETURN;
  END IF;

  UPDATE public.partners
  SET hierarchy_path  = public.calculate_hierarchy_path(id),
      hierarchy_depth = public.calculate_hierarchy_depth(id),
      is_root         = (parent_partner_id IS NULL)
  WHERE id = v_id;

  RAISE NOTICE '[第2段] 已对新建记录 id=% 显式回填层级字段', v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '[第2段] 命中唯一约束，视为已存在，跳过：%', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE '[第2段] 失败但不中断：% (SQLSTATE=%)', SQLERRM, SQLSTATE;
END
$seg2$;


-- ============================================================================
-- 第 3 段：回填 owner_partner_id
--   取值：partner_type='本公司' 中 created_at 最早的一条（并列时按 id 兜底）
--   只更新 owner_partner_id IS NULL 的行，重跑影响 0 行。
--   找不到本公司记录：NOTICE + 跳过，不报错、不中断。
--   使用 EXECUTE 而非静态 SQL，避免第 1 段失败（无该列）时本段出现编译期依赖错误。
-- ============================================================================
DO $seg3$
DECLARE
  v_owner_id uuid;
  v_cnt      integer;
  v_updated  integer := 0;
BEGIN
  IF to_regclass('public.partner_chains') IS NULL OR to_regclass('public.partners') IS NULL THEN
    RAISE NOTICE '[第3段] 跳过：partner_chains / partners 不存在';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partner_chains'
      AND column_name = 'owner_partner_id'
  ) THEN
    RAISE NOTICE '[第3段] 跳过：列 owner_partner_id 不存在（第1段未成功）';
    RETURN;
  END IF;

  SELECT count(*) INTO v_cnt
  FROM public.partners
  WHERE partner_type = '本公司'::public.partner_type_enum;

  IF v_cnt = 0 THEN
    RAISE NOTICE '[第3段] 未找到 partner_type=本公司 的记录，回填跳过（可先执行第2段）';
    RETURN;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.partners
  WHERE partner_type = '本公司'::public.partner_type_enum
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  EXECUTE
    'UPDATE public.partner_chains
        SET owner_partner_id = $1
      WHERE owner_partner_id IS NULL'
  USING v_owner_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE NOTICE '[第3段] 所有链路已有归属方，本次回填 0 行（本公司 id=%）', v_owner_id;
  ELSE
    RAISE NOTICE '[第3段] 回填完成：% 条链路归属到 本公司 id=%（仅写 owner_partner_id，未触碰任何金额字段）',
      v_updated, v_owner_id;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[第3段] 失败但不中断：% (SQLSTATE=%)', SQLERRM, SQLSTATE;
END
$seg3$;


-- ============================================================================
-- 第 4 段：只读校验（纯 SELECT，可单独选中执行；不产生任何写入）
--   前提：第 1 段已成功，否则 4.1 / 4.3 会因列不存在报错。
-- ============================================================================

-- 4.0 结构自检：列是否存在、是否可空、外键定义
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name   = 'partner_chains'
  AND c.column_name  = 'owner_partner_id';

SELECT
  con.conname             AS "约束名",
  pg_get_constraintdef(con.oid) AS "约束定义"
FROM pg_constraint con
WHERE con.conrelid = 'public.partner_chains'::regclass
  AND con.conname  = 'partner_chains_owner_partner_id_fkey';

-- 4.1 已回填 / 未回填链路数
SELECT
  count(*) FILTER (WHERE owner_partner_id IS NOT NULL) AS "已回填链路数",
  count(*) FILTER (WHERE owner_partner_id IS NULL)     AS "未回填链路数",
  count(*)                                             AS "链路总数"
FROM public.partner_chains;

-- 4.2 本公司记录条数与 id（多于 1 条时需人工确认保留哪条作为归属方）
SELECT
  id,
  name,
  full_name,
  tax_rate,
  partner_type,
  user_id,
  created_at
FROM public.partners
WHERE partner_type = '本公司'::public.partner_type_enum
ORDER BY created_at ASC, id ASC;

-- 4.3 抽查 3 条链路，核对 owner 是否正确（owner_type 应为「本公司」）
SELECT
  pc.id                    AS "链路ID",
  pc.chain_name            AS "链路名称",
  pc.owner_partner_id      AS "归属方ID",
  p.name                   AS "归属方名称",
  p.partner_type           AS "归属方类型",
  pc.created_at            AS "链路创建时间"
FROM public.partner_chains pc
LEFT JOIN public.partners p ON p.id = pc.owner_partner_id
ORDER BY pc.created_at DESC
LIMIT 3;


-- ============================================================================
-- 第 5 段：回滚说明（仅为注释，不执行）
-- ============================================================================
-- 回滚 = 删掉新增字段，不涉及任何金额：
--
--   ALTER TABLE public.partner_chains
--     DROP CONSTRAINT IF EXISTS partner_chains_owner_partner_id_fkey;
--   ALTER TABLE public.partner_chains
--     DROP COLUMN IF EXISTS owner_partner_id;
--
-- 说明：
--   1) owner_partner_id 只承接「这条链路归哪个我司主体」的标签，
--      运单价格、logistics_partner_costs、logistics_records 里的任何
--      金额 / 税率 / 数量均不读取该字段，因此 DROP COLUMN 后
--      所有历史金额与财务报表数字完全不变，无需重算、无需对账。
--   2) 删除字段不会删除 partner_chains 任何行，也不会删除 partners 记录。
--   3) 若需彻底撤销代建的中科主数据（不建议，会影响后续归属），需先确认
--      没有任何 partner_chains.owner_partner_id 指向它，再按 id 精确删除：
--        DELETE FROM public.partners
--         WHERE id = '<中科 id>' AND partner_type = '本公司'::public.partner_type_enum
--           AND NOT EXISTS (SELECT 1 FROM public.partner_chains WHERE owner_partner_id = '<中科 id>');
--      若仍有链路引用，外键为 ON DELETE SET NULL，删除会把归属置空而非报错，
--      故必须先用上面的 NOT EXISTS 兜住，避免静默丢失归属信息。
-- ============================================================================
