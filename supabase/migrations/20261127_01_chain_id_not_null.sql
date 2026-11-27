-- ============================================================================
-- 用途：
--   1) 修正 logistics_partner_costs 中 base_amount / level 两个字段的错误注释
--      （现注释写着“上一级的应付金额”“数字越大级别越高”，与真实实现相反）；
--   2) 将 logistics_records.chain_id 收紧为 NOT NULL（数据质量兜底）；
--   3) 为 project_partners 增加唯一索引 uk_pp_chain_level(chain_id, level)，
--      防止同一链路同一级别出现多条配置，从根上避免成本行重复。
--
-- 风险等级：中
--   - SET NOT NULL 会短暂持有 ACCESS EXCLUSIVE 锁（小表秒级）；
--   - 若存在 chain_id 为空的运单，本脚本会在第 1 段直接中止，不会改结构；
--   - 若 project_partners 存在 (chain_id, level) 重复，第 3 段会中止且不建索引。
--
-- 前置检查：执行前先单独跑第 1 段（chain_id 空值检查）与第 3 段（重复检查）；
--           也可以先整份执行，两段都是“检查不过就 RAISE EXCEPTION 中止”，
--           不会留下半成品（每段独立，前面的 COMMENT 重复执行也无副作用）。
--
-- 回滚方式：见文件末尾注释块（手工执行，本文件不会自动回滚）。
--
-- 执行位置：Supabase Dashboard → SQL Editor（本项目未接入 CLI 迁移）
-- 幂等性：可重复执行；已加锁/已建索引会自动跳过。
-- ============================================================================

-- ============================================================================
-- 第 0 段：修正字段注释（当前注释与实现相反）
-- ============================================================================
COMMENT ON COLUMN public.logistics_partner_costs.base_amount IS
  '基础金额（= 运单司机运费 logistics_records.payable_cost，全层同一基数，不级联）';

COMMENT ON COLUMN public.logistics_partner_costs.level IS
  '合作方级别（1级、2级、3级，数字越大越靠近货主，金额越高）';

-- ============================================================================
-- 第 1 段【前置检查】：chain_id 是否还有空值
--   有则中止，不继续执行第 2 段。
-- ============================================================================
DO $$
DECLARE
    v_null_cnt BIGINT;
BEGIN
    SELECT count(*) INTO v_null_cnt
    FROM public.logistics_records
    WHERE chain_id IS NULL;

    IF v_null_cnt > 0 THEN
        RAISE EXCEPTION
            '前置检查失败：logistics_records 中有 % 条记录的 chain_id 为空（NULL）。请先补链或清理后再执行本迁移。', v_null_cnt;
    END IF;

    RAISE NOTICE '第 1 段通过：logistics_records 中不存在 chain_id 为空的运单。';
END;
$$;

-- ============================================================================
-- 第 2 段：chain_id SET NOT NULL（幂等：先查 pg_attribute.attnotnull）
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c       ON c.oid = a.attrelid
        JOIN pg_namespace n   ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'logistics_records'
          AND a.attname = 'chain_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attnotnull = TRUE
    ) THEN
        RAISE NOTICE '第 2 段跳过：logistics_records.chain_id 已经是 NOT NULL。';
    ELSE
        ALTER TABLE public.logistics_records ALTER COLUMN chain_id SET NOT NULL;
        RAISE NOTICE '第 2 段完成：logistics_records.chain_id 已设置为 NOT NULL。';
    END IF;
END;
$$;

-- ============================================================================
-- 第 3 段【前置检查】：project_partners 的 (chain_id, level) 是否重复
--   索引已存在则跳过检查；存在重复则列出前 20 组并中止，不建索引。
-- ============================================================================
DO $$
DECLARE
    v_dup_group_cnt BIGINT;
    v_detail        TEXT;
BEGIN
    -- 索引已存在 → 不可能有重复，直接跳过
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'uk_pp_chain_level'
          AND c.relkind = 'i'
    ) THEN
        RAISE NOTICE '第 3 段跳过：唯一索引 uk_pp_chain_level 已存在。';
        RETURN;
    END IF;

    SELECT count(*) INTO v_dup_group_cnt
    FROM (
        SELECT chain_id, level
        FROM public.project_partners
        GROUP BY chain_id, level
        HAVING count(*) > 1
    ) d;

    IF v_dup_group_cnt > 0 THEN
        SELECT string_agg(
                   format('  chain_id=%s, level=%s, 重复条数=%s', t.chain_id, t.level, t.cnt),
                   E'\n'
               )
        INTO v_detail
        FROM (
            SELECT chain_id, level, count(*) AS cnt
            FROM public.project_partners
            GROUP BY chain_id, level
            HAVING count(*) > 1
            ORDER BY count(*) DESC, chain_id, level
            LIMIT 20
        ) t;

        RAISE EXCEPTION
            E'前置检查失败：project_partners 存在 % 组 (chain_id, level) 重复，无法创建唯一索引 uk_pp_chain_level。\n前 20 组：\n%s\n请先清理重复配置后再重跑本迁移。',
            v_dup_group_cnt, v_detail;
    END IF;

    RAISE NOTICE '第 3 段通过：project_partners 的 (chain_id, level) 无重复。';
END;
$$;

-- ============================================================================
-- 第 4 段：创建唯一索引（幂等）
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uk_pp_chain_level
    ON public.project_partners (chain_id, level);

COMMENT ON INDEX public.uk_pp_chain_level IS
  '同一合作链路下每个级别只能有一个合作方，防止成本行重复生成';

-- ============================================================================
-- 完成提示
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '20261127_01_chain_id_not_null.sql 执行完成';
    RAISE NOTICE '  - 修正 2 个字段注释';
    RAISE NOTICE '  - logistics_records.chain_id NOT NULL';
    RAISE NOTICE '  - project_partners 唯一索引 uk_pp_chain_level';
    RAISE NOTICE '========================================';
END;
$$;

-- ============================================================================
-- 回滚 SQL（手工执行，本文件不会自动执行以下语句）
-- ============================================================================
-- -- 1) 删除唯一索引
-- DROP INDEX IF EXISTS public.uk_pp_chain_level;
--
-- -- 2) 取消 NOT NULL
-- ALTER TABLE public.logistics_records ALTER COLUMN chain_id DROP NOT NULL;
--
-- -- 3) 恢复原注释（迁移前的实际内容）
-- COMMENT ON COLUMN public.logistics_partner_costs.base_amount IS '基础金额（上一级的应付金额，元，2位小数）';
-- COMMENT ON COLUMN public.logistics_partner_costs.level IS '合作方级别（1级、2级、3级等，数字越大级别越高）';
