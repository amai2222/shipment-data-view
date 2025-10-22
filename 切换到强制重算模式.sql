-- ==========================================
-- 切换到强制重算模式（重算所有运单，包括已付款）
-- ==========================================
-- 警告：这会修改已付款运单的成本数据！
-- 执行前请确认是否真的需要
-- ==========================================

BEGIN;

-- 修改触发器函数，使用强制模式
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
        v_should_recalc := TRUE;
    ELSIF TG_OP = 'INSERT' THEN
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
    
    -- 执行重算（强制模式：重算所有运单，包括已付款）⚠️
    IF v_should_recalc THEN
        IF TG_OP = 'DELETE' THEN
            -- 强制重算：包括已付款的运单
            PERFORM public.recalculate_costs_for_chain(OLD.project_id, OLD.chain_id);
            RAISE NOTICE '已删除合作方，重算链路 % 的所有运单成本（包括已付款）', OLD.chain_id;
            RETURN OLD;
        ELSE
            -- 强制重算：包括已付款的运单
            PERFORM public.recalculate_costs_for_chain(NEW.project_id, NEW.chain_id);
            RAISE NOTICE '已更新合作方配置，重算链路 % 的所有运单成本（包括已付款）', NEW.chain_id;
            RETURN NEW;
        END IF;
    END IF;
    
    -- 不需要重算时直接返回
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_recalc_on_project_partner_change IS '自动重算项目合作方变更时的运单成本（强制模式：重算所有运单）';

COMMIT;

-- ⚠️ 警告信息
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  已切换到强制重算模式';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '当前配置：';
    RAISE NOTICE '  - 修改项目配置时重算所有运单';
    RAISE NOTICE '  - 包括已付款的运单 ⚠️';
    RAISE NOTICE '  - 可能影响已完成的财务记录 ⚠️';
    RAISE NOTICE '';
    RAISE NOTICE '建议：';
    RAISE NOTICE '  - 除非确实需要，否则建议使用安全模式';
    RAISE NOTICE '  - 要切回安全模式，执行原迁移文件';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

