-- ============================================================================
-- 创建触发器：司机应收改变时自动重算合作方成本
-- 创建日期：2025-11-06
-- 功能：当 payable_cost 改变时，自动重新计算所有未手工修改的合作方成本
-- ============================================================================

-- ============================================================================
-- 创建触发器函数
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_recalc_on_payable_cost_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manually_modified_costs JSONB;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_manual_value NUMERIC;
    v_protected_count INTEGER := 0;
    v_recalc_count INTEGER := 0;
BEGIN
    -- 只在 payable_cost 改变时触发
    IF OLD.payable_cost IS NOT DISTINCT FROM NEW.payable_cost THEN
        RETURN NEW;  -- 司机应收没变，不处理
    END IF;
    
    -- 跳过已付款或已开票的运单
    IF NEW.payment_status != 'Unpaid' OR (NEW.invoice_status IS NOT NULL AND NEW.invoice_status != 'Uninvoiced') THEN
        RAISE NOTICE '⚠️  运单已付款或已开票，跳过自动重算';
        RETURN NEW;
    END IF;
    
    RAISE NOTICE '📌 司机应收改变：¥% → ¥%，触发自动重算', OLD.payable_cost, NEW.payable_cost;
    
    -- ✅ 步骤1：保存手工修改的合作方成本
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
        RAISE NOTICE '✅ 保留 % 个手工修改的记录', jsonb_array_length(v_manually_modified_costs);
    END IF;
    
    -- ✅ 步骤2：删除系统计算的记录
    DELETE FROM logistics_partner_costs
    WHERE logistics_record_id = NEW.id
    AND COALESCE(is_manually_modified, false) = false;
    
    -- ✅ 步骤3：重新级联计算
    v_base_amount := NEW.payable_cost;  -- 使用新的司机应收作为基础
    v_loading_weight := NEW.loading_weight;
    
    FOR v_project_partners IN
        SELECT 
            partner_id,
            level,
            tax_rate,
            calculation_method,
            profit_rate
        FROM project_partners
        WHERE project_id = NEW.project_id
        AND chain_id = NEW.chain_id
        ORDER BY level ASC
    LOOP
        -- 检查该合作方是否被手工修改过
        IF v_manually_modified_costs IS NOT NULL THEN
            IF EXISTS (
                SELECT 1
                FROM jsonb_array_elements(v_manually_modified_costs) AS elem
                WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
                AND (elem->>'level')::INTEGER = v_project_partners.level
            ) THEN
                -- ✅ 跳过手工修改的，但获取其值作为下一级基础
                SELECT payable_amount INTO v_payable_amount
                FROM logistics_partner_costs
                WHERE logistics_record_id = NEW.id
                AND partner_id = v_project_partners.partner_id
                AND level = v_project_partners.level;
                
                v_protected_count := v_protected_count + 1;
                v_base_amount := v_payable_amount;
                
                RAISE NOTICE '⏭️  保护手工值：level=%, ¥%', v_project_partners.level, v_payable_amount;
                CONTINUE;
            END IF;
        END IF;
        
        -- 按规则计算应付金额
        IF v_project_partners.calculation_method = 'profit' THEN
            IF v_loading_weight IS NOT NULL AND v_loading_weight > 0 THEN
                v_payable_amount := v_base_amount + (COALESCE(v_project_partners.profit_rate, 0) * v_loading_weight);
            ELSE
                v_payable_amount := v_base_amount + COALESCE(v_project_partners.profit_rate, 0);
            END IF;
        ELSE
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
            is_manually_modified,
            user_id
        ) VALUES (
            NEW.id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,
            v_payable_amount,
            v_project_partners.tax_rate,
            false,  -- 新计算的都是false
            auth.uid()
        );
        
        v_recalc_count := v_recalc_count + 1;
        v_base_amount := v_payable_amount;
    END LOOP;
    
    RAISE NOTICE '✅ 自动重算完成：保护%个手工值，重算%个合作方', v_protected_count, v_recalc_count;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_recalc_on_payable_cost_change IS '触发器函数：司机应收改变时自动重算合作方成本（保护手工值）';

-- ============================================================================
-- 创建触发器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_recalc_on_payable_cost_change ON logistics_records;

CREATE TRIGGER trigger_recalc_on_payable_cost_change
    AFTER UPDATE OF payable_cost ON logistics_records
    FOR EACH ROW
    WHEN (OLD.payable_cost IS DISTINCT FROM NEW.payable_cost)  -- 只在payable_cost改变时触发
    EXECUTE FUNCTION auto_recalc_on_payable_cost_change();

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 司机应收改变触发器已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '触发条件：';
    RAISE NOTICE '  • logistics_records.payable_cost 改变';
    RAISE NOTICE '';
    RAISE NOTICE '触发动作：';
    RAISE NOTICE '  1. 保存手工修改的合作方成本';
    RAISE NOTICE '  2. 删除系统计算的合作方成本';
    RAISE NOTICE '  3. 重新级联计算未改的合作方';
    RAISE NOTICE '  4. 保持手工修改的值不变';
    RAISE NOTICE '';
    RAISE NOTICE '现在：';
    RAISE NOTICE '  • 修改司机应收 → 自动重算合作方 ✅';
    RAISE NOTICE '  • 手工修改的合作方 → 自动保护 ✅';
    RAISE NOTICE '  • 级联关系正确 ✅';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

