-- ============================================================================
-- 添加触发器：当有效数量或基础运价改变时，自动重算合作方成本
-- 日期：2025-11-20
-- 说明：支持直接定价法（fixed_price）在有效数量改变时自动重算
-- ============================================================================

-- ============================================================================
-- 创建触发器函数：当有效数量或基础运价改变时重算
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_recalc_on_effective_quantity_or_cost_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manually_modified_costs JSONB;
    v_protected_count INTEGER := 0;
    v_recalc_count INTEGER := 0;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_effective_quantity NUMERIC;
    v_project_partners RECORD;
    v_should_recalc BOOLEAN := false;
BEGIN
    -- 判断是否需要重算
    -- 1. 有效数量改变（影响直接定价法）
    IF (OLD.effective_quantity IS DISTINCT FROM NEW.effective_quantity) THEN
        v_should_recalc := true;
        RAISE NOTICE '📌 有效数量改变：% → %，触发自动重算', OLD.effective_quantity, NEW.effective_quantity;
    END IF;
    
    -- 2. 基础运价改变（影响税点法和利润法）
    IF (OLD.payable_cost IS DISTINCT FROM NEW.payable_cost) THEN
        v_should_recalc := true;
        RAISE NOTICE '📌 基础运价改变：¥% → ¥%，触发自动重算', OLD.payable_cost, NEW.payable_cost;
    END IF;
    
    -- 3. 装货重量或卸货重量改变（可能影响有效数量，进而影响直接定价法）
    IF (OLD.loading_weight IS DISTINCT FROM NEW.loading_weight) 
       OR (OLD.unloading_weight IS DISTINCT FROM NEW.unloading_weight) THEN
        -- 如果有效数量还没更新，先计算新的有效数量
        IF NEW.effective_quantity IS NULL OR NEW.effective_quantity = 0 THEN
            NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
                NEW.loading_weight,
                NEW.unloading_weight,
                NEW.project_id,
                NEW.chain_id
            );
        END IF;
        v_should_recalc := true;
        RAISE NOTICE '📌 重量改变：装货 % → %, 卸货 % → %，触发自动重算', 
            OLD.loading_weight, NEW.loading_weight, OLD.unloading_weight, NEW.unloading_weight;
    END IF;
    
    -- 如果不需要重算，直接返回
    IF NOT v_should_recalc THEN
        RETURN NEW;
    END IF;
    
    -- ✅ 保护逻辑：只对【未付款 且 未开票 且 未收款】的运单重算
    -- 如果不满足条件（已付款 OR 已开票 OR 已收款），跳过重算
    IF NEW.payment_status != 'Unpaid' 
       OR (NEW.invoice_status IS NOT NULL AND NEW.invoice_status != 'Uninvoiced')
       OR (NEW.receipt_status IS NOT NULL AND NEW.receipt_status = 'Received') THEN
        RAISE NOTICE '⚠️  运单状态不满足重算条件（必须：未付款 且 未开票 且 未收款），跳过自动重算';
        RETURN NEW;
    END IF;
    
    -- 通过上述检查，说明运单状态为：未付款 AND 未开票 AND 未收款 → 允许重算
    
    -- ✅ 步骤1：保存所有手工修改的记录
    SELECT json_agg(
        json_build_object(
            'partner_id', partner_id,
            'level', level,
            'payable_amount', payable_amount
        )
    )
    INTO v_manually_modified_costs
    FROM logistics_partner_costs
    WHERE logistics_record_id = NEW.id
    AND is_manually_modified = true;
    
    IF v_manually_modified_costs IS NOT NULL THEN
        RAISE NOTICE '✅ 保护手工修改：% 个记录', jsonb_array_length(v_manually_modified_costs);
    END IF;
    
    -- ✅ 步骤2：只删除is_manually_modified=false的记录
    DELETE FROM logistics_partner_costs
    WHERE logistics_record_id = NEW.id
    AND COALESCE(is_manually_modified, false) = false;
    
    -- ✅ 步骤3：获取运单基础信息
    v_base_amount := NEW.payable_cost;
    v_loading_weight := NEW.loading_weight;
    v_unloading_weight := NEW.unloading_weight;
    v_effective_quantity := NEW.effective_quantity;
    
    -- ✅ 步骤4：重新计算所有合作方成本
    FOR v_project_partners IN
        SELECT 
            partner_id,
            level,
            tax_rate,
            calculation_method,
            profit_rate,
            unit_price  -- 新增：直接定价法的单价
        FROM project_partners
        WHERE project_id = NEW.project_id
        AND chain_id = NEW.chain_id
        ORDER BY level ASC
    LOOP
        -- 检查该合作方是否被手工修改过（已保留，跳过不插入）
        IF v_manually_modified_costs IS NOT NULL THEN
            IF EXISTS (
                SELECT 1
                FROM jsonb_array_elements(v_manually_modified_costs) AS elem
                WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
                AND (elem->>'level')::INTEGER = v_project_partners.level
            ) THEN
                v_protected_count := v_protected_count + 1;
                RAISE NOTICE '⏭️  保护手工修改：level=%, 跳过重算', v_project_partners.level;
                CONTINUE;
            END IF;
        END IF;
        
        -- ✅ 根据计算方法计算应付金额
        IF v_project_partners.calculation_method = 'fixed_price' THEN
            -- 直接定价法：有效数量 × 单价
            IF v_effective_quantity IS NOT NULL AND v_effective_quantity > 0 
               AND v_project_partners.unit_price IS NOT NULL AND v_project_partners.unit_price > 0 THEN
                v_payable_amount := v_effective_quantity * v_project_partners.unit_price;
                RAISE NOTICE '💰 直接定价法：有效数量 % × 单价 % = %', 
                    v_effective_quantity, v_project_partners.unit_price, v_payable_amount;
            ELSE
                v_payable_amount := 0;
                RAISE NOTICE '⚠️  直接定价法：有效数量或单价为0，应付金额设为0';
            END IF;
        ELSIF v_project_partners.calculation_method = 'profit' THEN
            -- 利润法：基础金额 + (利润 × 装货重量)
            IF v_loading_weight IS NOT NULL AND v_loading_weight > 0 THEN
                v_payable_amount := v_base_amount + (COALESCE(v_project_partners.profit_rate, 0) * v_loading_weight);
            ELSE
                v_payable_amount := v_base_amount + COALESCE(v_project_partners.profit_rate, 0);
            END IF;
        ELSE
            -- 税点法（默认）：基础金额 / (1 - 税点)
            IF v_project_partners.tax_rate IS NOT NULL AND v_project_partners.tax_rate != 1 THEN
                v_payable_amount := v_base_amount / (1 - v_project_partners.tax_rate);
            ELSE
                v_payable_amount := v_base_amount;
            END IF;
        END IF;
        
        v_payable_amount := ROUND(v_payable_amount, 2);
        
        -- 插入新计算的记录
        INSERT INTO logistics_partner_costs (
            logistics_record_id,
            partner_id,
            level,
            base_amount,
            payable_amount,
            tax_rate,
            is_manually_modified
        ) VALUES (
            NEW.id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,  -- 对于直接定价法，base_amount 仍然记录 payable_cost（用于参考）
            v_payable_amount,
            v_project_partners.tax_rate,
            false
        );
        
        v_recalc_count := v_recalc_count + 1;
    END LOOP;
    
    RAISE NOTICE '✅ 自动重算完成：保护%个手工值，重算%个合作方', v_protected_count, v_recalc_count;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_recalc_on_effective_quantity_or_cost_change IS '触发器函数：当有效数量或基础运价改变时自动重算合作方成本（支持直接定价法、税点法、利润法）';

-- ============================================================================
-- 创建触发器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_recalc_on_effective_quantity_or_cost_change ON public.logistics_records;

CREATE TRIGGER trigger_recalc_on_effective_quantity_or_cost_change
    AFTER UPDATE OF effective_quantity, payable_cost, loading_weight, unloading_weight, chain_id, project_id
    ON public.logistics_records
    FOR EACH ROW
    WHEN (
        -- 只在以下情况触发：
        -- 1. 有效数量改变
        (OLD.effective_quantity IS DISTINCT FROM NEW.effective_quantity)
        -- 2. 基础运价改变
        OR (OLD.payable_cost IS DISTINCT FROM NEW.payable_cost)
        -- 3. 重量改变（可能影响有效数量）
        OR (OLD.loading_weight IS DISTINCT FROM NEW.loading_weight)
        OR (OLD.unloading_weight IS DISTINCT FROM NEW.unloading_weight)
        -- 4. 链路或项目改变（可能影响有效数量计算）
        OR (OLD.chain_id IS DISTINCT FROM NEW.chain_id)
        OR (OLD.project_id IS DISTINCT FROM NEW.project_id)
    )
    EXECUTE FUNCTION public.auto_recalc_on_effective_quantity_or_cost_change();

COMMENT ON TRIGGER trigger_recalc_on_effective_quantity_or_cost_change ON public.logistics_records IS 
'自动重算触发器：当有效数量、基础运价、重量、链路或项目改变时，自动重算合作方成本（支持直接定价法）';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 自动重算触发器已创建！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '触发条件：';
    RAISE NOTICE '  • 有效数量改变（影响直接定价法）';
    RAISE NOTICE '  • 基础运价改变（影响税点法和利润法）';
    RAISE NOTICE '  • 重量改变（可能影响有效数量）';
    RAISE NOTICE '  • 链路或项目改变（可能影响有效数量计算）';
    RAISE NOTICE '';
    RAISE NOTICE '保护机制：';
    RAISE NOTICE '  • 保护手工修改的合作方成本';
    RAISE NOTICE '  • 跳过已付款、已开票或已收款的运单';
    RAISE NOTICE '========================================';
END;
$$;

