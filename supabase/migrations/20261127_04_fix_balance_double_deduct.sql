-- ============================================================================
-- 用途：
--   修复“改链/重算导致货主余额被重复扣减”的问题。
--   现状（20251114_merged_all_receipt_and_balance_functions.sql）：
--     · 只有 AFTER INSERT 扣款触发器 trigger_deduct_balance_on_cost_insert；
--     · 重算函数是 DELETE 旧行 + INSERT 新行，且可能执行两遍；
--     · 没有 AFTER DELETE 回补 → 每删一次旧行，之前扣掉的钱就永久蒸发；
--       每插一次新行，再扣一次 → 净效果是余额被扣 2 次甚至 3 次。
--
--   本文件只“新增”对象，不删除、不修改任何已有触发器/函数：
--     1) partner_balance_transactions 增加 related_cost_id UUID（若无）；
--     2) AFTER DELETE ON logistics_partner_costs → 回补余额 + 写 type='reverse' 流水；
--     3) AFTER UPDATE OF payable_amount → 按差额调整余额 + 写 type='adjust' 流水；
--     4) 全部余额更新走 INSERT ... ON CONFLICT (partner_id) DO UPDATE 单语句原子 upsert。
--
-- 风险等级：高
--   - 直接作用在资金类数据（partner_balance）上；
--   - 与既有触发器存在“同事件叠加”的已知冲突（见第 5 段注释），需要人工决策。
--
-- 前置检查：执行前先跑第 1 段（表/字段/唯一约束检查）与第 2 段（当前余额与流水
--           是否已经不一致的只读快照，作为修复前基线）。
--
-- 回滚方式：见文件末尾注释块（手工执行）。
--
-- 执行位置：Supabase Dashboard → SQL Editor（本项目未接入 CLI 迁移）
-- 幂等性：可重复执行（ADD COLUMN 前查 information_schema；索引 IF NOT EXISTS；
--         触发器先 DROP TRIGGER IF EXISTS 再 CREATE；函数 CREATE OR REPLACE）。
-- ============================================================================

-- ============================================================================
-- 第 1 段【前置检查】：依赖对象与约束
-- ============================================================================
DO $$
BEGIN
    IF to_regclass('public.logistics_partner_costs') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.logistics_partner_costs 不存在。';
    END IF;
    IF to_regclass('public.partner_balance') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.partner_balance 不存在。';
    END IF;
    IF to_regclass('public.partner_balance_transactions') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.partner_balance_transactions 不存在。';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'partner_balance'
          AND column_name = 'partner_id'
    ) THEN
        RAISE EXCEPTION '前置检查失败：partner_balance 缺少 partner_id 字段。';
    END IF;

    -- 余额 upsert 依赖 partner_id 上的唯一约束/主键
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class rel     ON rel.oid = i.indrelid
        JOIN pg_namespace n   ON n.oid = rel.relnamespace
        JOIN pg_attribute a   ON a.attrelid = rel.oid AND a.attnum = i.indkey[0]
        WHERE n.nspname = 'public'
          AND rel.relname = 'partner_balance'
          AND i.indisunique = TRUE
          AND i.indnkeyatts = 1
          AND a.attname = 'partner_id'
          AND a.attnum > 0
    ) THEN
        RAISE EXCEPTION '前置检查失败：partner_balance.partner_id 上没有单列主键/唯一约束，ON CONFLICT (partner_id) 无法工作。';
    END IF;

    RAISE NOTICE '第 1 段通过：依赖对象与唯一约束齐备。';
END;
$$;

-- ============================================================================
-- 第 2 段【只读基线】：修复前先看当前余额与流水是否已不一致
-- ============================================================================
-- SELECT b.partner_id,
--        p.name,
--        b.balance                                   AS balance_now,
--        COALESCE(t.tx_sum, 0)                       AS tx_sum_now,
--        b.balance - COALESCE(t.tx_sum, 0)           AS diff_now
-- FROM public.partner_balance b
-- JOIN public.partners p ON p.id = b.partner_id
-- LEFT JOIN (
--     SELECT partner_id, SUM(amount) AS tx_sum
--     FROM public.partner_balance_transactions
--     GROUP BY partner_id
-- ) t ON t.partner_id = b.partner_id
-- WHERE ABS(b.balance - COALESCE(t.tx_sum, 0)) > 0.01
-- ORDER BY ABS(b.balance - COALESCE(t.tx_sum, 0)) DESC;

-- ============================================================================
-- 第 3 段：加列 + 索引
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'partner_balance_transactions'
          AND column_name  = 'related_cost_id'
    ) THEN
        ALTER TABLE public.partner_balance_transactions ADD COLUMN related_cost_id UUID;
        RAISE NOTICE '第 3 段：已新增列 partner_balance_transactions.related_cost_id';
    ELSE
        RAISE NOTICE '第 3 段跳过：related_cost_id 已存在。';
    END IF;
END;
$$;

COMMENT ON COLUMN public.partner_balance_transactions.related_cost_id IS
  '关联的成本行ID（logistics_partner_costs.id）；用于回补/调整流水的幂等判断';

CREATE INDEX IF NOT EXISTS idx_pbt_related_cost_id
    ON public.partner_balance_transactions (related_cost_id);

-- 同一个成本行只允许一条 reverse 流水 → 从数据库层面保证回补幂等
CREATE UNIQUE INDEX IF NOT EXISTS uk_pbt_reverse_cost
    ON public.partner_balance_transactions (related_cost_id)
    WHERE transaction_type = 'reverse' AND related_cost_id IS NOT NULL;

-- ============================================================================
-- 第 4 段：AFTER DELETE 回补
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_reverse_balance_on_cost_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_type TEXT;
    v_delta        NUMERIC(15,2);
    v_before       NUMERIC(15,2);
    v_after        NUMERIC(15,2);
BEGIN
    -- 仅处理“货主”类型的成本行
    SELECT p.partner_type::TEXT INTO v_partner_type
    FROM public.partners p
    WHERE p.id = OLD.partner_id;

    IF v_partner_type IS DISTINCT FROM '货主' THEN
        RETURN OLD;
    END IF;

    v_delta := ROUND(COALESCE(OLD.payable_amount, 0)::NUMERIC, 2);

    -- 与 INSERT 扣款触发器的口径保持一致：只回补被扣过的正金额
    IF v_delta <= 0 THEN
        RETURN OLD;
    END IF;

    -- 幂等：同一成本行已有 reverse 流水则跳过
    IF EXISTS (
        SELECT 1
        FROM public.partner_balance_transactions t
        WHERE t.related_cost_id   = OLD.id
          AND t.transaction_type  = 'reverse'
    ) THEN
        RAISE NOTICE '⚠️ 成本行 % 已存在 reverse 流水，跳过回补', OLD.id;
        RETURN OLD;
    END IF;

    -- 原子 upsert：行不存在则插入，存在则累加；一次语句拿到 before/after
    INSERT INTO public.partner_balance AS pb (partner_id, balance, updated_at)
    VALUES (OLD.partner_id, v_delta, NOW())
    ON CONFLICT (partner_id) DO UPDATE
        SET balance    = pb.balance + v_delta,
            updated_at = NOW()
    RETURNING pb.balance - v_delta, pb.balance
    INTO v_before, v_after;

    INSERT INTO public.partner_balance_transactions (
        partner_id,
        transaction_type,
        transaction_category,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        reference_number,
        description,
        created_by,
        related_cost_id
    ) VALUES (
        OLD.partner_id,
        'reverse',
        'waybill',
        v_delta,
        v_before,
        v_after,
        'waybill',
        OLD.logistics_record_id,
        NULL,
        format('成本行删除回补：运单ID %s，成本行ID %s，回补金额 ¥%s',
               OLD.logistics_record_id, OLD.id, v_delta),
        auth.uid(),
        OLD.id
    );

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.trigger_reverse_balance_on_cost_delete() IS
  '成本行删除时把 payable_amount 加回货主余额，并写 type=reverse 流水（按 related_cost_id 幂等）';

DROP TRIGGER IF EXISTS trg_lpc_reverse_balance_on_delete ON public.logistics_partner_costs;
CREATE TRIGGER trg_lpc_reverse_balance_on_delete
AFTER DELETE ON public.logistics_partner_costs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_reverse_balance_on_cost_delete();

-- ============================================================================
-- 第 5 段：AFTER UPDATE OF payable_amount 差额调整
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_adjust_balance_on_cost_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_type  TEXT;
    v_diff          NUMERIC(15,2);  -- 新-旧；正数 = 应付变多 = 需要多扣
    v_balance_delta NUMERIC(15,2);  -- 余额增量；扣款为负
    v_before        NUMERIC(15,2);
    v_after         NUMERIC(15,2);
BEGIN
    SELECT p.partner_type::TEXT INTO v_partner_type
    FROM public.partners p
    WHERE p.id = NEW.partner_id;

    IF v_partner_type IS DISTINCT FROM '货主' THEN
        RETURN NEW;
    END IF;

    v_diff := ROUND(COALESCE(NEW.payable_amount, 0)::NUMERIC
                    - COALESCE(OLD.payable_amount, 0)::NUMERIC, 2);

    IF v_diff = 0 THEN
        RETURN NEW;
    END IF;

    v_balance_delta := -v_diff;  -- 应付 +10 → 余额 -10

    INSERT INTO public.partner_balance AS pb (partner_id, balance, updated_at)
    VALUES (NEW.partner_id, v_balance_delta, NOW())
    ON CONFLICT (partner_id) DO UPDATE
        SET balance    = pb.balance + v_balance_delta,
            updated_at = NOW()
    RETURNING pb.balance - v_balance_delta, pb.balance
    INTO v_before, v_after;

    INSERT INTO public.partner_balance_transactions (
        partner_id,
        transaction_type,
        transaction_category,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        reference_number,
        description,
        created_by,
        related_cost_id
    ) VALUES (
        NEW.partner_id,
        'adjust',
        'waybill',
        v_balance_delta,
        v_before,
        v_after,
        'waybill',
        NEW.logistics_record_id,
        NULL,
        format('成本行金额调整：运单ID %s，成本行ID %s，原 ¥%s → 新 ¥%s（余额变动 ¥%s）',
               NEW.logistics_record_id, NEW.id,
               COALESCE(OLD.payable_amount, 0), COALESCE(NEW.payable_amount, 0), v_balance_delta),
        auth.uid(),
        NEW.id
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_adjust_balance_on_cost_update() IS
  '成本行 payable_amount 变更时按差额调整货主余额，并写 type=adjust 流水';

DROP TRIGGER IF EXISTS trg_lpc_adjust_balance_on_update ON public.logistics_partner_costs;
CREATE TRIGGER trg_lpc_adjust_balance_on_update
AFTER UPDATE OF payable_amount ON public.logistics_partner_costs
FOR EACH ROW
WHEN (OLD.payable_amount IS DISTINCT FROM NEW.payable_amount)
EXECUTE FUNCTION public.trigger_adjust_balance_on_cost_update();

-- ----------------------------------------------------------------------------
-- ⚠️ 已知冲突（本文件未自动处理，需人工确认）
--   20251114 已存在的 trigger_recalculate_balance_on_cost_update 同样挂在
--   AFTER UPDATE OF payable_amount 上，且把 (新-旧) 直接当余额增量（符号是反的）。
--   两个触发器叠加后：本次 +(-diff) 与旧触发器 +(+diff) 相互抵消，
--   结果是“改金额时余额不变”，仍然不对。
--
--   建议停用旧触发器（本文件不会执行，确认后再手工跑）：
--   ALTER TABLE public.logistics_partner_costs
--       DISABLE TRIGGER trigger_recalculate_balance_on_cost_update;
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 第 6 段：对账 SQL（只读）
-- ============================================================================
-- 6.1 余额 vs 流水汇总：不一致的合作方清单
-- SELECT b.partner_id,
--        p.name,
--        p.partner_type,
--        b.balance                          AS balance_now,
--        COALESCE(t.tx_sum, 0)              AS tx_sum,
--        b.balance - COALESCE(t.tx_sum, 0)  AS diff,
--        t.tx_cnt                           AS tx_cnt
-- FROM public.partner_balance b
-- JOIN public.partners p ON p.id = b.partner_id
-- LEFT JOIN (
--     SELECT partner_id, SUM(amount) AS tx_sum, count(*) AS tx_cnt
--     FROM public.partner_balance_transactions
--     GROUP BY partner_id
-- ) t ON t.partner_id = b.partner_id
-- WHERE ABS(b.balance - COALESCE(t.tx_sum, 0)) > 0.01
-- ORDER BY ABS(b.balance - COALESCE(t.tx_sum, 0)) DESC;
--
-- 6.2 应扣 vs 实扣（按运单）：成本行合计与流水合计不一致的运单
--     说明：deduct / recharge / reverse / adjust 四种流水的 reference_id
--           都等于 logistics_records.id，因此统一按 reference_id 汇总。
-- SELECT c.logistics_record_id,
--        SUM(c.payable_amount)                    AS cost_total,
--        COALESCE(t.net_amount, 0)                AS tx_net,
--        SUM(c.payable_amount) + COALESCE(t.net_amount, 0) AS gap
-- FROM public.logistics_partner_costs c
-- JOIN public.partners p ON p.id = c.partner_id AND p.partner_type = '货主'
-- LEFT JOIN (
--     SELECT reference_id, SUM(amount) AS net_amount
--     FROM public.partner_balance_transactions
--     WHERE transaction_type IN ('deduct', 'recharge', 'reverse', 'adjust')
--       AND reference_id IS NOT NULL
--     GROUP BY reference_id
-- ) t ON t.reference_id = c.logistics_record_id
-- GROUP BY c.logistics_record_id, t.net_amount
-- HAVING ABS(SUM(c.payable_amount) + COALESCE(t.net_amount, 0)) > 0.01
-- ORDER BY ABS(SUM(c.payable_amount) + COALESCE(t.net_amount, 0)) DESC
-- LIMIT 200;
--
-- 6.3 是否存在重复 reverse 流水（应恒为 0 行）
-- SELECT related_cost_id, count(*)
-- FROM public.partner_balance_transactions
-- WHERE transaction_type = 'reverse' AND related_cost_id IS NOT NULL
-- GROUP BY related_cost_id
-- HAVING count(*) > 1;

-- ============================================================================
-- 完成提示
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '20261127_04_fix_balance_double_deduct.sql 执行完成';
    RAISE NOTICE '  - partner_balance_transactions.related_cost_id（含索引 + reverse 幂等唯一索引）';
    RAISE NOTICE '  - trg_lpc_reverse_balance_on_delete（AFTER DELETE 回补）';
    RAISE NOTICE '  - trg_lpc_adjust_balance_on_update（AFTER UPDATE 差额调整）';
    RAISE NOTICE '⚠️ 旧触发器 trigger_recalculate_balance_on_cost_update 仍在，需人工确认是否停用';
    RAISE NOTICE '========================================';
END;
$$;

-- ============================================================================
-- 回滚 SQL（手工执行，本文件不会自动执行以下语句）
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_lpc_adjust_balance_on_update  ON public.logistics_partner_costs;
-- DROP TRIGGER IF EXISTS trg_lpc_reverse_balance_on_delete ON public.logistics_partner_costs;
-- DROP FUNCTION IF EXISTS public.trigger_adjust_balance_on_cost_update();
-- DROP FUNCTION IF EXISTS public.trigger_reverse_balance_on_cost_delete();
-- DROP INDEX IF EXISTS public.uk_pbt_reverse_cost;
-- DROP INDEX IF EXISTS public.idx_pbt_related_cost_id;
-- ALTER TABLE public.partner_balance_transactions DROP COLUMN IF EXISTS related_cost_id;
--
-- 注意：回滚不会撤销已经写入的 reverse / adjust 流水，也不会把余额改回去。
--       如需还原余额，请先备份 partner_balance，再按 6.1 的差异逐笔手工调整。
