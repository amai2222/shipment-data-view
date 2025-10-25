-- 修复自动重算触发器：避免不必要的重算
-- 问题：用户只是编辑项目，即使数据没变，也触发了重算
-- 解决：只在数据真正变化时才触发重算

-- ============================================================
-- 修改自动重算触发器函数
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
    v_result JSON;
BEGIN
    -- 判断是否需要重新计算
    IF TG_OP = 'DELETE' THEN
        -- 删除合作方时，必须重算
        v_should_recalc := TRUE;
        RAISE NOTICE '检测到DELETE操作，将触发重算';
    ELSIF TG_OP = 'INSERT' THEN
        -- 新增合作方时，必须重算
        v_should_recalc := TRUE;
        RAISE NOTICE '检测到INSERT操作，将触发重算';
    ELSIF TG_OP = 'UPDATE' THEN
        -- UPDATE 时，只在关键字段真正变化时才重算
        IF OLD.partner_id IS DISTINCT FROM NEW.partner_id OR
           OLD.level IS DISTINCT FROM NEW.level OR
           OLD.tax_rate IS DISTINCT FROM NEW.tax_rate OR
           OLD.calculation_method IS DISTINCT FROM NEW.calculation_method OR
           OLD.profit_rate IS DISTINCT FROM NEW.profit_rate THEN
            v_should_recalc := TRUE;
            RAISE NOTICE '检测到关键字段变化，将触发重算: partner_id=%, level=%, tax_rate=%, method=%, profit=%', 
                         NEW.partner_id, NEW.level, NEW.tax_rate, NEW.calculation_method, NEW.profit_rate;
        ELSE
            -- ✅ 数据没变，直接返回，不触发重算
            RAISE NOTICE '数据未变化，跳过重算: partner_id=%, level=%', NEW.partner_id, NEW.level;
            RETURN NEW;
        END IF;
    END IF;
    
    -- 执行重算（使用安全模式，跳过已付款运单）
    IF v_should_recalc THEN
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

COMMENT ON FUNCTION public.auto_recalc_on_project_partner_change IS '自动重算项目合作方变更时的运单成本（智能检测数据变化，避免不必要的重算）';

-- ============================================================
-- 说明
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '触发器修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  ✓ 在 UPDATE 时检查数据是否真正变化';
    RAISE NOTICE '  ✓ 数据未变化时直接返回，不触发重算';
    RAISE NOTICE '  ✓ 只在关键字段变化时才触发重算';
    RAISE NOTICE '';
    RAISE NOTICE '影响：';
    RAISE NOTICE '  ✓ 用户编辑项目时，如果没有实际修改合作方配置';
    RAISE NOTICE '  ✓ 不会触发不必要的成本重算';
    RAISE NOTICE '  ✓ 提升系统性能，减少等待时间';
    RAISE NOTICE '';
    RAISE NOTICE '检查的关键字段：';
    RAISE NOTICE '  - partner_id (合作方ID)';
    RAISE NOTICE '  - level (级别)';
    RAISE NOTICE '  - tax_rate (税点)';
    RAISE NOTICE '  - calculation_method (计算方式)';
    RAISE NOTICE '  - profit_rate (利润率)';
    RAISE NOTICE '';
    RAISE NOTICE '注意：';
    RAISE NOTICE '  - DELETE 和 INSERT 操作仍会触发重算';
    RAISE NOTICE '  - UPDATE 时只有关键字段变化才触发重算';
    RAISE NOTICE '  - 已付款运单仍然会被跳过（安全模式）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

