-- ============================================================================
-- 增强触发器：在手动模式下也自动计算有效数量和反推单价
-- 日期：2025-11-20
-- 说明：当用户在手动模式下只输入运费时，自动计算有效数量和单价
-- ============================================================================

-- 删除旧的触发器函数并重新创建
DROP FUNCTION IF EXISTS public.auto_calculate_cost_from_unit_price_1120() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_calculate_cost_from_unit_price_1120()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_calculated_cost NUMERIC;
    v_calculated_unit_price NUMERIC;
BEGIN
    -- 判断计算模式：有单价则为 auto，否则为 manual
    IF NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
        NEW.calculation_mode := 'auto';
    ELSE
        NEW.calculation_mode := 'manual';
    END IF;
    
    -- 计算有效数量（所有模式都需要）
    NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
        NEW.loading_weight,
        NEW.unloading_weight,
        NEW.project_id
    );
    
    -- 根据计算模式处理
    IF NEW.calculation_mode = 'auto' THEN
        -- ========================================
        -- 自动计算模式：单价 → 运费（不反推单价）
        -- ========================================
        IF NEW.effective_quantity IS NOT NULL AND NEW.effective_quantity > 0 THEN
            v_calculated_cost := NEW.unit_price * NEW.effective_quantity;
            NEW.current_cost := ROUND(v_calculated_cost, 2);
        ELSE
            NEW.current_cost := 0;
        END IF;
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
        
        RAISE NOTICE '✅ 自动计算模式 [项目=%]: 单价=% (用户输入), 有效数量=%, 运费=% (自动计算), 应付=%', 
            NEW.project_id, NEW.unit_price, NEW.effective_quantity, NEW.current_cost, NEW.payable_cost;
    ELSE
        -- ========================================
        -- 手动输入模式：运费 → 单价
        -- ========================================
        
        -- 反推单价：单价 = 运费 / 有效数量
        IF NEW.effective_quantity IS NOT NULL AND NEW.effective_quantity > 0 
           AND NEW.current_cost IS NOT NULL AND NEW.current_cost > 0 THEN
            v_calculated_unit_price := NEW.current_cost / NEW.effective_quantity;
            NEW.unit_price := ROUND(v_calculated_unit_price, 2);
            
            RAISE NOTICE '✅ 手动模式（反推单价）[项目=%]: 运费=%, 有效数量=%, 反推单价=%', 
                NEW.project_id, NEW.current_cost, NEW.effective_quantity, NEW.unit_price;
        ELSE
            -- 如果没有有效数量或运费，单价设为 NULL
            NEW.unit_price := NULL;
            
            RAISE NOTICE '⚠️ 手动模式（无法反推）[项目=%]: 运费=%, 有效数量=%', 
                NEW.project_id, NEW.current_cost, NEW.effective_quantity;
        END IF;
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_calculate_cost_from_unit_price_1120 IS '自动计算运费和单价的触发器函数：
- 自动模式：根据单价和有效数量计算运费
- 手动模式：根据运费和有效数量反推单价
- 所有模式都自动计算有效数量（根据项目配置）
更新日期：2025-11-20';

-- 重新创建触发器（确保触发器存在）
DROP TRIGGER IF EXISTS trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records;

CREATE TRIGGER trigger_auto_calculate_cost_from_unit_price_1120
    BEFORE INSERT OR UPDATE OF unit_price, loading_weight, unloading_weight, extra_cost, current_cost, chain_id, project_id
    ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_cost_from_unit_price_1120();

COMMENT ON TRIGGER trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records IS '运单费用自动计算触发器（2025-11-20版本）';

-- ============================================================================
-- 触发器部署完成
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 触发器已成功部署！';
    RAISE NOTICE '功能说明：';
    RAISE NOTICE '  - 自动模式：根据单价 × 有效数量自动计算运费';
    RAISE NOTICE '  - 手动模式：根据运费 ÷ 有效数量自动反推单价';
    RAISE NOTICE '  - 所有模式：自动计算有效数量（根据项目配置）';
    RAISE NOTICE '========================================';
END;
$$;

