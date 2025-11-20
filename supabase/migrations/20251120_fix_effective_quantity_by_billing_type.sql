-- ============================================================================
-- 修复有效数量计算逻辑：根据链路的计费模式确定有效数量
-- 日期：2025-11-20
-- 问题：有效数量应该根据链路的 billing_type_id 来确定，而不是只根据项目配置
-- 解决：修改计算函数，根据计费模式计算有效数量
-- ============================================================================

-- 先删除旧版本的函数（3个参数的版本），避免函数重载冲突
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 删除所有 get_effective_quantity_for_record_1120 的重载版本
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_effective_quantity_for_record_1120'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE '删除旧函数: %', r.func_signature;
    END LOOP;
END $$;

-- 创建新版本的有效数量计算函数，支持根据链路的计费模式计算
CREATE OR REPLACE FUNCTION public.get_effective_quantity_for_record_1120(
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC,
    p_project_id UUID,
    p_chain_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_quantity_type public.effective_quantity_type;
    v_billing_type_id BIGINT;
    v_result NUMERIC;
BEGIN
    -- 1. 获取链路的计费模式
    IF p_chain_id IS NOT NULL THEN
        SELECT billing_type_id INTO v_billing_type_id
        FROM public.partner_chains
        WHERE id = p_chain_id;
    END IF;
    
    -- 如果没有链路或链路没有 billing_type_id，使用默认值 1（计重）
    v_billing_type_id := COALESCE(v_billing_type_id, 1);
    
    -- 2. 如果是计车模式（billing_type_id = 2），有效数量固定为 1
    IF v_billing_type_id = 2 THEN
        RETURN 1;
    END IF;
    
    -- 3. 对于其他计费模式（计重/计方/计件），根据项目配置计算
    SELECT effective_quantity_type 
    INTO v_quantity_type
    FROM public.projects 
    WHERE id = p_project_id;
    
    v_quantity_type := COALESCE(v_quantity_type, 'min_value');
    
    CASE v_quantity_type
        WHEN 'loading' THEN
            v_result := COALESCE(p_loading_weight, 0);
        WHEN 'unloading' THEN
            v_result := COALESCE(p_unloading_weight, 0);
        ELSE -- 'min_value'
            IF p_loading_weight IS NOT NULL AND p_unloading_weight IS NOT NULL THEN
                v_result := LEAST(p_loading_weight, p_unloading_weight);
            ELSE
                v_result := COALESCE(p_unloading_weight, p_loading_weight, 0);
            END IF;
    END CASE;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_effective_quantity_for_record_1120(
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC,
    p_project_id UUID,
    p_chain_id UUID
) IS '根据链路计费模式和项目配置计算运单的有效数量（2025-11-20版本，支持根据 billing_type_id 计算）';

-- 修改触发器函数，传递 chain_id 参数
CREATE OR REPLACE FUNCTION public.auto_calculate_cost_from_unit_price_1120()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_calculated_cost NUMERIC;
BEGIN
    -- 判断计算模式：有单价则为 auto，否则为 manual
    IF NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
        NEW.calculation_mode := 'auto';
    ELSE
        NEW.calculation_mode := 'manual';
    END IF;
    
    -- 根据计算模式处理
    IF NEW.calculation_mode = 'auto' THEN
        -- 自动计算模式
        NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
            NEW.loading_weight,
            NEW.unloading_weight,
            NEW.project_id,
            NEW.chain_id  -- 传递 chain_id，用于获取 billing_type_id
        );
        
        IF NEW.effective_quantity IS NOT NULL AND NEW.effective_quantity > 0 THEN
            v_calculated_cost := NEW.unit_price * NEW.effective_quantity;
            NEW.current_cost := ROUND(v_calculated_cost, 2);
        ELSE
            NEW.current_cost := 0;
        END IF;
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
        
        RAISE NOTICE '✅ 自动计算[链路=%]: 单价=%, 装货=%, 卸货=%, 有效数量=%, 运费=%, 应付=%', 
            NEW.chain_id, NEW.unit_price, NEW.loading_weight, NEW.unloading_weight, 
            NEW.effective_quantity, NEW.current_cost, NEW.payable_cost;
    ELSE
        -- 手动输入模式
        NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
            NEW.loading_weight,
            NEW.unloading_weight,
            NEW.project_id,
            NEW.chain_id  -- 传递 chain_id，用于获取 billing_type_id
        );
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_calculate_cost_from_unit_price_1120 IS '自动计算运费触发器函数（2025-11-20版本，支持根据链路计费模式计算有效数量）';

-- 更新 RPC 函数中的有效数量计算
-- 注意：add_logistics_record_with_costs_1120 和 update_logistics_record_via_recalc_1120 
-- 函数内部会调用触发器，触发器会自动计算有效数量，所以不需要修改 RPC 函数

-- 但是，为了确保一致性，我们需要在 RPC 函数中也显式计算有效数量
-- 让我检查一下 RPC 函数是否需要修改...

-- 实际上，由于触发器会在 INSERT/UPDATE 时自动计算，RPC 函数不需要修改
-- 但为了确保数据一致性，我们可以在 RPC 函数中也显式设置

-- 验证修复
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 有效数量计算逻辑已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  ✓ get_effective_quantity_for_record_1120 现在接收 chain_id 参数';
    RAISE NOTICE '  ✓ 根据链路的 billing_type_id 确定计费模式';
    RAISE NOTICE '  ✓ 计车模式（billing_type_id=2）：有效数量固定为 1';
    RAISE NOTICE '  ✓ 其他模式：根据项目配置计算（装货/卸货/较小值）';
    RAISE NOTICE '  ✓ 触发器函数已更新，传递 chain_id 参数';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

