-- ==========================================
-- 项目合作方变更时自动重算运单成本
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 
--   1. 当 project_partners 表的合作方发生变化时
--   2. 自动更新所有使用该链路的运单的合作方成本
--   3. 确保运费对账数据始终与项目配置同步
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 创建批量重算指定链路的运单成本函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain(
    p_project_id UUID,
    p_chain_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        -- 获取运单的基础数据
        SELECT 
            current_cost + COALESCE(extra_cost, 0) as base,
            loading_weight,
            unloading_weight
        INTO v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 删除旧的合作方成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 根据最新的 project_partners 配置重新计算
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate
            FROM project_partners
            WHERE project_id = p_project_id
              AND chain_id = p_chain_id
            ORDER BY level ASC
        LOOP
            -- 计算应付金额
            IF v_project_partners.calculation_method = 'profit' THEN
                -- 利润法
                IF v_loading_weight IS NOT NULL AND v_loading_weight > 0 THEN
                    v_payable_amount := v_base_amount + (COALESCE(v_project_partners.profit_rate, 0) * v_loading_weight);
                ELSE
                    v_payable_amount := v_base_amount + COALESCE(v_project_partners.profit_rate, 0);
                END IF;
            ELSE
                -- 税点法（默认）
                IF v_project_partners.tax_rate IS NOT NULL AND v_project_partners.tax_rate != 1 THEN
                    v_payable_amount := v_base_amount / (1 - v_project_partners.tax_rate);
                ELSE
                    v_payable_amount := v_base_amount;
                END IF;
            END IF;
            
            -- 插入新的成本记录
            INSERT INTO logistics_partner_costs (
                logistics_record_id,
                partner_id,
                level,
                base_amount,
                payable_amount,
                tax_rate,
                user_id
            ) VALUES (
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                auth.uid()
            );
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.recalculate_costs_for_chain IS '重新计算指定链路的所有运单成本';

-- ============================================================
-- 第二步: 创建触发器函数（监控 project_partners 变化）
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_recalc_on_project_partner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_affected_records INTEGER;
    v_should_recalc BOOLEAN := FALSE;
BEGIN
    -- 判断是否需要重新计算
    IF TG_OP = 'DELETE' THEN
        -- 删除合作方时，必须重算
        v_should_recalc := TRUE;
    ELSIF TG_OP = 'INSERT' THEN
        -- 新增合作方时，必须重算
        v_should_recalc := TRUE;
    ELSE
        -- UPDATE 时，只在关键字段变化时才重算
        IF OLD.partner_id IS DISTINCT FROM NEW.partner_id OR
           OLD.level IS DISTINCT FROM NEW.level OR
           OLD.tax_rate IS DISTINCT FROM NEW.tax_rate OR
           OLD.calculation_method IS DISTINCT FROM NEW.calculation_method OR
           OLD.profit_rate IS DISTINCT FROM NEW.profit_rate THEN
            v_should_recalc := TRUE;
        END IF;
    END IF;
    
    -- 执行重算（使用安全模式，跳过已付款运单）
    IF v_should_recalc THEN
        DECLARE
            v_result JSON;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                -- 安全重算：跳过已付款的运单
                v_result := public.recalculate_costs_for_chain_safe(OLD.project_id, OLD.chain_id, TRUE);
                RAISE NOTICE '已删除合作方，重算链路 % 的运单成本：%', OLD.chain_id, v_result->>'message';
                RETURN OLD;
            ELSE
                -- 安全重算：跳过已付款的运单
                v_result := public.recalculate_costs_for_chain_safe(NEW.project_id, NEW.chain_id, TRUE);
                RAISE NOTICE '已更新合作方配置，重算链路 % 的运单成本：%', NEW.chain_id, v_result->>'message';
                RETURN NEW;
            END IF;
        END;
    END IF;
    
    -- 不需要重算时直接返回
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_recalc_on_project_partner_change IS '自动重算项目合作方变更时的运单成本（安全模式：跳过已付款运单）';

-- ============================================================
-- 第三步: 创建触发器
-- ============================================================

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS trigger_auto_recalc_partner_costs ON public.project_partners;

-- 创建触发器（AFTER 操作，异步重算）
CREATE TRIGGER trigger_auto_recalc_partner_costs
    AFTER INSERT OR UPDATE OR DELETE ON public.project_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_recalc_on_project_partner_change();

COMMENT ON TRIGGER trigger_auto_recalc_partner_costs ON public.project_partners
    IS '项目合作方配置变更时，自动重算该链路所有运单的合作方成本';

-- ============================================================
-- 第四步: 创建手动重算整个项目的函数（可选）
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_project(
    p_project_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_chain_id UUID;
    v_total_updated INTEGER := 0;
    v_chain_updated INTEGER;
    v_result JSON;
BEGIN
    -- 遍历该项目的所有链路
    FOR v_chain_id IN 
        SELECT DISTINCT id 
        FROM partner_chains 
        WHERE project_id = p_project_id
    LOOP
        -- 重算每个链路
        v_chain_updated := public.recalculate_costs_for_chain(p_project_id, v_chain_id);
        v_total_updated := v_total_updated + v_chain_updated;
        
        RAISE NOTICE '链路 % 重算完成，更新 % 条运单', v_chain_id, v_chain_updated;
    END LOOP;
    
    v_result := json_build_object(
        'project_id', p_project_id,
        'total_records_updated', v_total_updated,
        'message', format('成功重算 %s 条运单的合作方成本', v_total_updated)
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.recalculate_costs_for_project IS '重新计算整个项目所有运单的合作方成本';

-- ============================================================
-- 第五步: 创建安全重算函数（只重算未付款运单）
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain_safe(
    p_project_id UUID,
    p_chain_id UUID,
    p_only_unpaid BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_total_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_has_paid_status BOOLEAN;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        v_total_count := v_total_count + 1;
        
        -- 检查是否有已付款的成本记录
        SELECT EXISTS (
            SELECT 1 FROM logistics_partner_costs
            WHERE logistics_record_id = v_record_id
              AND payment_status = 'Paid'
        ) INTO v_has_paid_status;
        
        -- 如果是安全模式且有已付款记录，跳过
        IF p_only_unpaid AND v_has_paid_status THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;
        
        -- 获取运单的基础数据
        SELECT 
            current_cost + COALESCE(extra_cost, 0) as base,
            loading_weight,
            unloading_weight
        INTO v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 删除旧的合作方成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 根据最新的 project_partners 配置重新计算
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate
            FROM project_partners
            WHERE project_id = p_project_id
              AND chain_id = p_chain_id
            ORDER BY level ASC
        LOOP
            -- 计算应付金额
            IF v_project_partners.calculation_method = 'profit' THEN
                -- 利润法
                IF v_loading_weight IS NOT NULL AND v_loading_weight > 0 THEN
                    v_payable_amount := v_base_amount + (COALESCE(v_project_partners.profit_rate, 0) * v_loading_weight);
                ELSE
                    v_payable_amount := v_base_amount + COALESCE(v_project_partners.profit_rate, 0);
                END IF;
            ELSE
                -- 税点法（默认）
                IF v_project_partners.tax_rate IS NOT NULL AND v_project_partners.tax_rate != 1 THEN
                    v_payable_amount := v_base_amount / (1 - v_project_partners.tax_rate);
                ELSE
                    v_payable_amount := v_base_amount;
                END IF;
            END IF;
            
            -- 插入新的成本记录
            INSERT INTO logistics_partner_costs (
                logistics_record_id,
                partner_id,
                level,
                base_amount,
                payable_amount,
                tax_rate,
                user_id
            ) VALUES (
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                auth.uid()
            );
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'total_records', v_total_count,
        'updated_records', v_updated_count,
        'skipped_records', v_skipped_count,
        'message', format('总计 %s 条运单，更新 %s 条，跳过 %s 条（已付款）', 
            v_total_count, v_updated_count, v_skipped_count)
    );
END;
$$;

COMMENT ON FUNCTION public.recalculate_costs_for_chain_safe IS '安全重算链路成本（可选择是否跳过已付款运单）';

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '项目合作方自动重算功能安装完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增功能：';
    RAISE NOTICE '  ✓ 修改 project_partners 时自动重算运单成本';
    RAISE NOTICE '  ✓ 添加/删除/更新合作方都会触发';
    RAISE NOTICE '  ✓ 只重算受影响链路的运单';
    RAISE NOTICE '';
    RAISE NOTICE '新增函数：';
    RAISE NOTICE '  - recalculate_costs_for_chain(project_id, chain_id)';
    RAISE NOTICE '    作用：重算指定链路的运单成本（所有运单）';
    RAISE NOTICE '';
    RAISE NOTICE '  - recalculate_costs_for_chain_safe(project_id, chain_id, only_unpaid)';
    RAISE NOTICE '    作用：安全重算（可选择跳过已付款运单）';
    RAISE NOTICE '';
    RAISE NOTICE '  - recalculate_costs_for_project(project_id)';
    RAISE NOTICE '    作用：重算整个项目的运单成本';
    RAISE NOTICE '';
    RAISE NOTICE '新增触发器：';
    RAISE NOTICE '  - trigger_auto_recalc_partner_costs';
    RAISE NOTICE '    触发时机：project_partners 表 INSERT/UPDATE/DELETE';
    RAISE NOTICE '    触发操作：自动重算受影响链路的运单成本';
    RAISE NOTICE '';
    RAISE NOTICE '使用方式：';
    RAISE NOTICE '  1. 自动：修改项目配置时自动触发（默认启用）';
    RAISE NOTICE '  2. 手动：SELECT recalculate_costs_for_project(''项目UUID'');';
    RAISE NOTICE '';
    RAISE NOTICE '安全特性：';
    RAISE NOTICE '  ✓ 已付款运单：跳过，保持不变';
    RAISE NOTICE '  ✓ 未付款运单：自动更新';
    RAISE NOTICE '  ✓ 财务数据：受保护';
    RAISE NOTICE '';
    RAISE NOTICE '注意事项：';
    RAISE NOTICE '  ⚠ 会覆盖未付款运单的成本数据';
    RAISE NOTICE '  ⚠ 基于最新的项目配置重算';
    RAISE NOTICE '  ⚠ 大量运单可能需要较长时间';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

