-- ============================================================================
-- 修复手动模式：保持用户输入的整数金额，不重新计算
-- 创建时间: 2025-11-22
-- 问题：手动模式下反推单价后，如果触发器再次触发，会重新计算运费导致整数变成小数
-- 解决：只有calculation_mode='auto'时才根据单价计算运费，manual模式保持用户输入不变
-- ============================================================================

-- 删除并重新创建触发器函数
DROP FUNCTION IF EXISTS public.auto_calculate_cost_from_unit_price_1120() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_calculate_cost_from_unit_price_1120()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_calculated_cost NUMERIC;
    v_calculated_unit_price NUMERIC;
    v_original_current_cost NUMERIC;  -- 保存用户原始输入的运费
BEGIN
    -- 保存用户原始输入的current_cost（如果存在）
    v_original_current_cost := COALESCE(NEW.current_cost, OLD.current_cost);
    
    -- ✅ 关键修复：判断计算模式（优先使用calculation_mode字段）
    IF NEW.calculation_mode IS NOT NULL THEN
        -- 用户明确指定了计算模式，使用用户指定的模式（不做修改）
        NULL;  -- 保持NEW.calculation_mode不变
    ELSIF OLD.calculation_mode IS NOT NULL THEN
        -- 保持原有的计算模式
        NEW.calculation_mode := OLD.calculation_mode;
    ELSIF (NEW.current_cost IS NULL OR NEW.current_cost = 0) 
          AND NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
        -- 新记录：用户输入了单价但没有运费 → auto模式
        NEW.calculation_mode := 'auto';
    ELSE
        -- 新记录：用户输入了运费（或两者都没有）→ manual模式
        NEW.calculation_mode := 'manual';
    END IF;
    
    -- 计算有效数量（所有模式都需要）
    NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
        NEW.loading_weight,
        NEW.unloading_weight,
        NEW.project_id,
        NEW.chain_id
    );
    
    -- ✅ 关键修复：只有自动计算模式才根据单价计算运费
    IF NEW.calculation_mode = 'auto' THEN
        -- ========================================
        -- 自动计算模式：单价 → 运费
        -- ========================================
        -- 只有在auto模式下，单价变化才重新计算运费
        IF NEW.effective_quantity IS NOT NULL AND NEW.effective_quantity > 0 
           AND NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
            v_calculated_cost := NEW.unit_price * NEW.effective_quantity;
            NEW.current_cost := ROUND(v_calculated_cost, 2);
        ELSE
            NEW.current_cost := COALESCE(NEW.current_cost, 0);
        END IF;
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
        
        RAISE NOTICE '✅ 自动计算模式 [项目=%]: 单价=% (用户输入), 有效数量=%, 运费=% (自动计算), 应付=%', 
            NEW.project_id, NEW.unit_price, NEW.effective_quantity, NEW.current_cost, NEW.payable_cost;
    ELSE
        -- ========================================
        -- 手动输入模式：保持用户输入的运费，只反推单价
        -- ========================================
        
        -- ✅ 关键修复：手动模式下，保持用户输入的current_cost不变
        -- 如果用户已经输入了current_cost，使用用户输入的值（优先使用NEW，如果没有则使用OLD）
        IF NEW.current_cost IS NOT NULL AND NEW.current_cost > 0 THEN
            -- 用户新输入了运费，保持用户输入的值
            v_original_current_cost := NEW.current_cost;
        ELSIF OLD.current_cost IS NOT NULL AND OLD.current_cost > 0 THEN
            -- 用户没有新输入，保持原来的值
            v_original_current_cost := OLD.current_cost;
            NEW.current_cost := OLD.current_cost;
        ELSE
            -- 没有运费，设为0
            v_original_current_cost := 0;
            NEW.current_cost := 0;
        END IF;
        
        -- ✅ 反推单价并保存到数据库（仅用于显示，不用于计算）
        IF NEW.effective_quantity IS NOT NULL AND NEW.effective_quantity > 0 
           AND v_original_current_cost > 0 THEN
            v_calculated_unit_price := v_original_current_cost / NEW.effective_quantity;
            NEW.unit_price := ROUND(v_calculated_unit_price, 2);
            
            RAISE NOTICE '✅ 手动模式（反推单价）[项目=%]: 运费=% (用户输入，保持不变), 有效数量=%, 反推单价=% (已保存到数据库)', 
                NEW.project_id, v_original_current_cost, NEW.effective_quantity, NEW.unit_price;
        ELSE
            -- 如果没有有效数量或运费，单价设为 NULL
            NEW.unit_price := NULL;
            
            RAISE NOTICE '⚠️ 手动模式（无法反推）[项目=%]: 运费=%, 有效数量=%', 
                NEW.project_id, v_original_current_cost, NEW.effective_quantity;
        END IF;
        
        -- ✅ 手动模式下，payable_cost = 用户输入的current_cost + extra_cost（不重新计算）
        NEW.payable_cost := COALESCE(v_original_current_cost, 0) + COALESCE(NEW.extra_cost, 0);
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_calculate_cost_from_unit_price_1120 IS '自动计算运费和单价的触发器函数（修复版）：
- 自动模式（calculation_mode=auto）：根据单价和有效数量计算运费
- 手动模式（calculation_mode=manual）：保持用户输入的运费不变，只反推单价并保存到数据库
- 所有模式都自动计算有效数量（根据项目配置）
修复日期：2025-11-22';

-- 重新创建触发器
DROP TRIGGER IF EXISTS trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records;

CREATE TRIGGER trigger_auto_calculate_cost_from_unit_price_1120
    BEFORE INSERT OR UPDATE OF unit_price, loading_weight, unloading_weight, extra_cost, current_cost, chain_id, project_id, calculation_mode
    ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_cost_from_unit_price_1120();

COMMENT ON TRIGGER trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records IS '运单费用自动计算触发器（2025-11-22修复版：只有auto模式才计算运费，manual模式保持用户输入）';

-- ============================================================================
-- 修复完成说明
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 触发器已修复！';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  - 只有calculation_mode=auto时才根据单价计算运费';
    RAISE NOTICE '  - manual模式下，保持用户输入的运费不变';
    RAISE NOTICE '  - manual模式下，反推单价并保存到数据库（仅显示用）';
    RAISE NOTICE '  - 避免整数金额变成小数的问题';
    RAISE NOTICE '';
    RAISE NOTICE '功能说明：';
    RAISE NOTICE '  - 自动模式：根据单价 × 有效数量自动计算运费';
    RAISE NOTICE '  - 手动模式：保持用户输入的运费，反推单价保存到数据库';
    RAISE NOTICE '  - 所有模式：自动计算有效数量（根据项目配置）';
    RAISE NOTICE '========================================';
END;
$$;

