-- ============================================================================
-- 用途：
--   修复 modify_logistics_record_chain_with_recalc_1126 的两个缺陷：
--   (A) 成本行翻倍 / 金额翻倍
--       原实现顺序是：DELETE 旧成本行 → UPDATE chain_id（触发 AFTER 重算，又插一套）
--       → 再手动 INSERT 一套，最终同一运单同一级别出现 2 套成本行，金额合计翻倍。
--   (B) fixed_price 链路被错误地按税点法重算
--       原实现在循环里只取了 tax_rate / profit_rate，没有取 unit_price，
--       于是 calculation_method='fixed_price' 的链路落到 ELSE 分支，
--       按 base_amount/(1-tax_rate) 计算，与“有效数量 × 单价”的口径完全不同。
--
--   本文件用同名函数覆盖（CREATE OR REPLACE），入参 / 返回值 / 权限校验
--   （has_function_permission('data.modify_chain')）与原实现完全一致。
--
-- 风险等级：高
--   - 覆盖的是线上正在使用的业务函数，影响“改链”这一写操作；
--   - 函数内部会 DELETE 运单的成本行，执行期间该运单不可被其他会话并发改链。
--
-- 前置检查：执行前先跑第 1 段（依赖对象 / 字段 / 函数存在性检查），
--           并跑第 2 段（历史重复成本行只读排查，只看不改）。
--
-- 回滚方式：见文件末尾“回滚 SQL”注释块
--           （把 20251124_replace_all_hardcoded_permissions_1126.sql 第 624-823 行
--             原函数定义重新执行一遍即可还原）。
--
-- 执行位置：Supabase Dashboard → SQL Editor（本项目未接入 CLI 迁移）
-- 幂等性：CREATE OR REPLACE，可重复执行。
-- ============================================================================
--
-- ============================================================================
-- 关于“怎么屏蔽重算触发器” —— 两种方案，二选一，本文件默认用 Plan B
-- ============================================================================
-- Plan A（全局屏蔽，spec 首选写法；本文件未启用，代码见下方注释）：
--     SET LOCAL session_replication_role = replica;   -- 屏蔽所有普通用户触发器
--     ... UPDATE chain_id / DELETE / INSERT ...
--     SET LOCAL session_replication_role = origin;
--   注意：
--     1) 需要函数属主具备 superuser（或至少是复制角色），否则报
--        “permission denied to set parameter "session_replication_role"”；
--     2) 它屏蔽的是【全部】普通触发器，不只是重算触发器；而
--        partner_balance 的扣款触发器 trigger_deduct_balance_on_cost_insert
--        也是普通触发器，会被一并屏蔽 → 成本行插入了但余额不扣，账实不符。
--        因此本文件不把它作为默认方案。
--
-- Plan B（本文件实际采用）：
--     1) 先保存手工修改值（内存 jsonb）
--     2) DELETE 该运单全部旧成本行
--     3) UPDATE chain_id（AFTER 触发器自己会按新链路插一套，且带 fixed_price 支持）
--     4) 再用 INSERT ... WHERE NOT EXISTS 补齐“还缺的行”——触发器已经插过的不会再插
--     5) 把手工修改值 UPDATE 回去
--   优势：不需要 superuser；不会连带屏蔽余额触发器；即使重算触发器重跑两遍
--         也不会产生重复行（NOT EXISTS 天然幂等）。
--   说明：第 3 步 UPDATE 后触发器“找不到旧行”这件事本身并不能阻止重复插入
--        （重算函数是无条件按 project_partners 插入的），所以第 4 步必须带
--        NOT EXISTS 守卫，这是本文件与原实现最本质的区别。
-- ============================================================================

-- ============================================================================
-- 第 1 段【前置检查】：依赖对象是否存在
-- ============================================================================
DO $$
BEGIN
    IF to_regclass('public.logistics_records') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.logistics_records 不存在。';
    END IF;
    IF to_regclass('public.logistics_partner_costs') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.logistics_partner_costs 不存在。';
    END IF;
    IF to_regclass('public.project_partners') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.project_partners 不存在。';
    END IF;
    IF to_regclass('public.partner_chains') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：表 public.partner_chains 不存在。';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_partners'
          AND column_name = 'unit_price'
    ) THEN
        RAISE EXCEPTION '前置检查失败：project_partners 缺少 unit_price 字段，无法支持 fixed_price 定价法。';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_partners'
          AND column_name = 'calculation_method'
    ) THEN
        RAISE EXCEPTION '前置检查失败：project_partners 缺少 calculation_method 字段。';
    END IF;

    -- 必须是带 p_chain_id 的 4 参数版本（20251120_fix_effective_quantity_by_billing_type 之后的版本）
    IF to_regprocedure('public.get_effective_quantity_for_record_1120(numeric,numeric,uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：函数 get_effective_quantity_for_record_1120(numeric,numeric,uuid,uuid) 不存在（需要 20251120_fix_effective_quantity_by_billing_type 及以后的版本），无法计算有效数量。';
    END IF;

    IF to_regprocedure('public.has_function_permission(text)') IS NULL THEN
        RAISE EXCEPTION '前置检查失败：函数 has_function_permission(text) 不存在，权限校验无法执行。';
    END IF;

    RAISE NOTICE '第 1 段通过：依赖对象齐备。';
END;
$$;

-- ============================================================================
-- 第 2 段【只读排查】：当前是否存在历史重复成本行（不改数据）
--   正常情况应返回 0 行。若有，请先决定是否用文末“清理 SQL”处理。
-- ============================================================================
-- SELECT c.logistics_record_id,
--        count(*)                              AS row_cnt,
--        count(DISTINCT c.partner_id)          AS partner_cnt,
--        sum(c.payable_amount)                 AS total_payable,
--        array_agg(c.id ORDER BY c.id)         AS cost_ids
-- FROM public.logistics_partner_costs c
-- GROUP BY c.logistics_record_id
-- HAVING count(*) > count(DISTINCT c.partner_id)
-- ORDER BY row_cnt DESC
-- LIMIT 100;

-- ============================================================================
-- 第 3 段：函数重写
-- ============================================================================
CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain_with_recalc_1126(
    p_record_id UUID,
    p_chain_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_project_id              UUID;
    v_chain_id                UUID;
    v_old_chain_name          TEXT;
    v_payment_status          TEXT;
    v_invoice_status          TEXT;
    v_manual                  RECORD;
    v_base_amount             NUMERIC;
    v_loading_weight          NUMERIC;
    v_unloading_weight        NUMERIC;
    v_effective_quantity      NUMERIC;
    v_inserted_count          INTEGER := 0;
    v_protected_count         INTEGER := 0;
    v_manually_modified_costs JSONB;
BEGIN
    -- ✅ 权限校验：与原实现完全一致，不改动
    IF NOT public.has_function_permission('data.modify_chain') THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：您没有修改合作链路的权限。请联系管理员在权限管理中分配 "data.modify_chain" 权限。'
        );
    END IF;

    -- 取运单信息
    -- 基础金额口径与 _1120 系列重算函数保持一致：司机运费 payable_cost；
    -- 历史数据 payable_cost 为空时回退到旧口径 current_cost + extra_cost。
    SELECT
        lr.project_id,
        pc.chain_name,
        COALESCE(lr.payable_cost, lr.current_cost + COALESCE(lr.extra_cost, 0), 0),
        lr.loading_weight,
        lr.unloading_weight,
        lr.effective_quantity,
        lr.payment_status,
        lr.invoice_status
    INTO
        v_project_id,
        v_old_chain_name,
        v_base_amount,
        v_loading_weight,
        v_unloading_weight,
        v_effective_quantity,
        v_payment_status,
        v_invoice_status
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE lr.id = p_record_id;

    IF v_project_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', '运单记录不存在');
    END IF;

    IF v_payment_status <> 'Unpaid' THEN
        RETURN json_build_object('success', false, 'message', '只有未支付状态的运单才能修改合作链路');
    END IF;

    IF v_invoice_status IS NOT NULL AND v_invoice_status <> 'Uninvoiced' THEN
        RETURN json_build_object('success', false, 'message', '只有未开票状态的运单才能修改合作链路');
    END IF;

    -- 新链路
    SELECT id INTO v_chain_id
    FROM public.partner_chains
    WHERE project_id = v_project_id
      AND chain_name = p_chain_name
    LIMIT 1;

    IF v_chain_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', '指定的合作链路不存在');
    END IF;

    -- 有效数量：为空/0 时按项目+链路配置补算（fixed_price 必需）
    IF v_effective_quantity IS NULL OR v_effective_quantity = 0 THEN
        v_effective_quantity := public.get_effective_quantity_for_record_1120(
            v_loading_weight,
            v_unloading_weight,
            v_project_id,
            v_chain_id
        );
    END IF;

    -- ✅ 保存手工修改的成本（按 partner_id + level 匹配）
    SELECT jsonb_agg(
               jsonb_build_object(
                   'partner_id', partner_id,
                   'level', level,
                   'payable_amount', payable_amount
               )
           )
    INTO v_manually_modified_costs
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id
      AND is_manually_modified = TRUE;

    RAISE NOTICE '📌 保存手动修改的成本：%',
        COALESCE(jsonb_array_length(v_manually_modified_costs), 0);

    ----------------------------------------------------------------------------
    -- 步骤 1：删除该运单全部旧成本行（含手工行，手工值已在上面存进内存）
    ----------------------------------------------------------------------------
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;

    ----------------------------------------------------------------------------
    -- 步骤 2：更新链路
    --   AFTER 触发器 trigger_recalc_on_effective_quantity_or_cost_change 会在这里触发，
    --   按新链路插入一套成本行（并支持 fixed_price）。
    --   若触发器因 receipt_status='Received' 等原因跳过，则由步骤 3 兜底补齐。
    ----------------------------------------------------------------------------
    UPDATE public.logistics_records
    SET chain_id   = v_chain_id,
        updated_at = NOW()
    WHERE id = p_record_id;

    ----------------------------------------------------------------------------
    -- 步骤 3：按新链路补齐缺失的成本行（NOT EXISTS 守卫 → 绝不与触发器重复）
    --   计算结果与 _1120 重算口径一致：
    --     fixed_price : ROUND(有效数量 × unit_price, 2)
    --     profit      : ROUND(base + profit_rate × 装货重量, 2)
    --     其他（税点）: ROUND(base / (1 - tax_rate), 2)
    ----------------------------------------------------------------------------
    INSERT INTO public.logistics_partner_costs (
        logistics_record_id,
        partner_id,
        level,
        base_amount,
        payable_amount,
        tax_rate,
        user_id,
        is_manually_modified
    )
    SELECT
        p_record_id,
        pp.partner_id,
        pp.level,
        v_base_amount,
        CASE
            WHEN m.payable_amount IS NOT NULL THEN m.payable_amount
            WHEN pp.calculation_method = 'fixed_price' THEN
                CASE
                    WHEN v_effective_quantity IS NOT NULL AND v_effective_quantity > 0
                         AND pp.unit_price IS NOT NULL AND pp.unit_price > 0
                    THEN ROUND(v_effective_quantity * pp.unit_price, 2)
                    ELSE 0
                END
            WHEN pp.calculation_method = 'profit' THEN
                CASE
                    WHEN v_loading_weight IS NOT NULL AND v_loading_weight > 0
                    THEN ROUND(v_base_amount + COALESCE(pp.profit_rate, 0) * v_loading_weight, 2)
                    ELSE ROUND(v_base_amount + COALESCE(pp.profit_rate, 0), 2)
                END
            ELSE
                CASE
                    WHEN pp.tax_rate IS NOT NULL AND pp.tax_rate <> 1
                    THEN ROUND(v_base_amount / (1 - pp.tax_rate), 2)
                    ELSE ROUND(v_base_amount, 2)
                END
        END,
        pp.tax_rate,
        auth.uid(),
        (m.payable_amount IS NOT NULL)
    FROM public.project_partners pp
    LEFT JOIN LATERAL (
        SELECT (elem ->> 'payable_amount')::NUMERIC AS payable_amount
        FROM jsonb_array_elements(COALESCE(v_manually_modified_costs, '[]'::JSONB)) AS elem
        WHERE (elem ->> 'partner_id')::UUID = pp.partner_id
          AND (elem ->> 'level')::INTEGER  = pp.level
        LIMIT 1
    ) m ON TRUE
    WHERE pp.project_id = v_project_id
      AND pp.chain_id   = v_chain_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.logistics_partner_costs c
          WHERE c.logistics_record_id = p_record_id
            AND c.partner_id = pp.partner_id
            AND c.level      = pp.level
      )
    ORDER BY pp.level ASC;

    ----------------------------------------------------------------------------
    -- 步骤 4：把手工修改值写回（针对“触发器刚插入的、非手工”的行）
    --   步骤 3 已经写出 is_manually_modified=TRUE 的行不会被重复覆盖。
    ----------------------------------------------------------------------------
    IF v_manually_modified_costs IS NOT NULL THEN
        FOR v_manual IN
            SELECT (elem ->> 'partner_id')::UUID      AS partner_id,
                   (elem ->> 'level')::INTEGER        AS level,
                   (elem ->> 'payable_amount')::NUMERIC AS payable_amount
            FROM jsonb_array_elements(v_manually_modified_costs) AS elem
        LOOP
            UPDATE public.logistics_partner_costs
            SET payable_amount      = v_manual.payable_amount,
                is_manually_modified = TRUE,
                updated_at           = NOW()
            WHERE logistics_record_id = p_record_id
              AND partner_id = v_manual.partner_id
              AND level      = v_manual.level
              AND COALESCE(is_manually_modified, FALSE) = FALSE;

            IF FOUND THEN
                v_protected_count := v_protected_count + 1;
                RAISE NOTICE '✅ 恢复手动值：合作方(level=%) → ¥%', v_manual.level, v_manual.payable_amount;
            END IF;
        END LOOP;
    END IF;

    -- 统计最终结果
    SELECT count(*) INTO v_inserted_count
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;

    RETURN json_build_object(
        'success', true,
        'message', format('链路修改成功，当前共%s个合作方成本行，恢复%s个手动值', v_inserted_count, v_protected_count),
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count,
        'protected_manual_costs', v_protected_count
    );
END;
$function$;

COMMENT ON FUNCTION public.modify_logistics_record_chain_with_recalc_1126(UUID, TEXT) IS
  '修改运单合作链路（含成本重算，使用统一权限系统检查权限：has_function_permission(''data.modify_chain'')）；20261127 修复成本行翻倍 + 支持 fixed_price 单价';

-- ============================================================================
-- 完成提示
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '20261127_03_fix_chain_change_double.sql 执行完成';
    RAISE NOTICE '  - 改链顺序：DELETE → UPDATE chain_id → INSERT(带 NOT EXISTS 守卫)';
    RAISE NOTICE '  - 支持 calculation_method = fixed_price（有效数量 × unit_price）';
    RAISE NOTICE '  - 手工修改值按 partner_id + level 保留';
    RAISE NOTICE '========================================';
END;
$$;

-- ============================================================================
-- 附 1：重复成本行排查 SQL（只读，可随时执行）
-- ============================================================================
-- -- 1.1 同一运单同一 partner+level 出现多行（最常见形态）
-- SELECT logistics_record_id, partner_id, level, count(*) AS cnt,
--        array_agg(id ORDER BY id)    AS cost_ids,
--        array_agg(payable_amount ORDER BY id) AS amounts
-- FROM public.logistics_partner_costs
-- GROUP BY logistics_record_id, partner_id, level
-- HAVING count(*) > 1
-- ORDER BY cnt DESC
-- LIMIT 100;
--
-- -- 1.2 同一运单成本行数 != 该链路配置的合作方数（金额翻倍的典型特征）
-- SELECT lr.id AS logistics_record_id, lr.auto_number, lr.chain_id,
--        (SELECT count(*) FROM public.logistics_partner_costs c
--          WHERE c.logistics_record_id = lr.id) AS cost_rows,
--        (SELECT count(*) FROM public.project_partners pp
--          WHERE pp.project_id = lr.project_id AND pp.chain_id = lr.chain_id) AS expected_rows
-- FROM public.logistics_records lr
-- WHERE lr.chain_id IS NOT NULL
--   AND (SELECT count(*) FROM public.logistics_partner_costs c
--         WHERE c.logistics_record_id = lr.id)
--     <> (SELECT count(*) FROM public.project_partners pp
--          WHERE pp.project_id = lr.project_id AND pp.chain_id = lr.chain_id)
-- ORDER BY lr.created_at DESC
-- LIMIT 100;

-- ============================================================================
-- 附 2：重复成本行清理 SQL（会改数据，务必先执行 2.1 备份，再执行 2.2）
--   规则：同一 (logistics_record_id, partner_id, level) 只保留 id 最小的一行。
--   注意：本段默认全部注释，需要时逐段取消注释执行。
-- ============================================================================
-- -- 2.1 备份重复行（备份表只建一次）
-- CREATE TABLE IF NOT EXISTS public.logistics_partner_costs_dup_bak (LIKE public.logistics_partner_costs INCLUDING DEFAULTS);
-- ALTER TABLE public.logistics_partner_costs_dup_bak ADD COLUMN IF NOT EXISTS backup_at TIMESTAMPTZ DEFAULT now();
--
-- INSERT INTO public.logistics_partner_costs_dup_bak
-- SELECT c.*
-- FROM public.logistics_partner_costs c
-- JOIN (
--     SELECT logistics_record_id, partner_id, level, min(id::TEXT) AS keep_id_txt
--     FROM public.logistics_partner_costs
--     GROUP BY logistics_record_id, partner_id, level
--     HAVING count(*) > 1
-- ) d
--   ON d.logistics_record_id = c.logistics_record_id
--  AND d.partner_id          = c.partner_id
--  AND d.level               = c.level
-- WHERE c.id::TEXT <> d.keep_id_txt;
--
-- -- 2.2 删除重复行（保留每个分组 id 最小的一行）
-- DELETE FROM public.logistics_partner_costs c
-- USING (
--     SELECT logistics_record_id, partner_id, level, min(id::TEXT) AS keep_id_txt
--     FROM public.logistics_partner_costs
--     GROUP BY logistics_record_id, partner_id, level
--     HAVING count(*) > 1
-- ) d
-- WHERE d.logistics_record_id = c.logistics_record_id
--   AND d.partner_id          = c.partner_id
--   AND d.level               = c.level
--   AND c.id::TEXT <> d.keep_id_txt;
--
-- -- 2.3 核对：应返回 0 行
-- SELECT logistics_record_id, partner_id, level, count(*)
-- FROM public.logistics_partner_costs
-- GROUP BY logistics_record_id, partner_id, level
-- HAVING count(*) > 1;

-- ============================================================================
-- 回滚 SQL（手工执行）
-- ============================================================================
-- 重新执行 20251124_replace_all_hardcoded_permissions_1126.sql 中
-- 第 621~823 行（modify_logistics_record_chain_with_recalc_1126 原定义）即可还原。
-- 注意：还原会同时把“成本行翻倍”和“fixed_price 失效”两个缺陷带回来。
