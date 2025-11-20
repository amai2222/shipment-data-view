-- ============================================================================
-- 更新重算函数：支持直接定价法（fixed_price）
-- 日期：2025-11-20
-- 说明：修改所有重算函数，支持第三种计算方法
-- ============================================================================

-- ============================================================================
-- 第一步：更新 batch_recalculate_partner_costs 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_recalculate_partner_costs_1120(p_record_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
    v_total_count INTEGER := 0;
    v_updated_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_effective_quantity NUMERIC;  -- 新增：有效数量
    v_chain_id UUID;
    v_project_id UUID;
    v_manually_modified_costs JSONB;
    v_manual_value NUMERIC;
    v_is_manual BOOLEAN;
    v_record_status RECORD;  -- 改为 RECORD 类型，包含 payment_status, invoice_status, receipt_status
BEGIN
    -- 遍历每个运单ID
    FOREACH v_record_id IN ARRAY p_record_ids
    LOOP
        v_total_count := v_total_count + 1;
        
        -- ✅ 保护逻辑：只对【未付款 且 未开票 且 未收款】的运单重算
        -- 检查运单状态
        SELECT 
            payment_status,
            invoice_status,
            receipt_status
        INTO v_record_status
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 如果不满足"未付款 且 未开票 且 未收款"的条件，跳过重算
        -- 即：已付款 OR 已开票 OR 已收款 → 跳过
        IF v_record_status.payment_status != 'Unpaid' 
           OR (v_record_status.invoice_status IS NOT NULL AND v_record_status.invoice_status != 'Uninvoiced')
           OR (v_record_status.receipt_status IS NOT NULL AND v_record_status.receipt_status = 'Received') THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;  -- 跳过该运单
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
        WHERE logistics_record_id = v_record_id
        AND is_manually_modified = true;
        
        IF v_manually_modified_costs IS NOT NULL THEN
            RAISE NOTICE '📌 保护手工修改：% 个记录', jsonb_array_length(v_manually_modified_costs);
        END IF;
        
        -- ✅ 步骤2：只删除is_manually_modified=false的记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id
        AND COALESCE(is_manually_modified, false) = false;
        
        -- 获取运单基础信息（使用payable_cost作为重算基础）
        SELECT 
            chain_id,
            project_id,
            payable_cost,  -- ✅ 使用payable_cost（司机应收合计）
            loading_weight,
            unloading_weight,
            effective_quantity  -- 新增：获取有效数量
        INTO v_chain_id, v_project_id, v_base_amount, v_loading_weight, v_unloading_weight, v_effective_quantity
        FROM logistics_records
        WHERE id = v_record_id;
        
        IF v_chain_id IS NULL OR v_project_id IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;
        
        -- 如果有效数量为空，重新计算
        IF v_effective_quantity IS NULL OR v_effective_quantity = 0 THEN
            v_effective_quantity := public.get_effective_quantity_for_record_1120(
                v_loading_weight,
                v_unloading_weight,
                v_project_id,
                v_chain_id
            );
        END IF;
        
        -- ✅ 关键步骤3：重新计算所有合作方成本（每个level独立计算）
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate,
                unit_price  -- 新增：直接定价法的单价
            FROM project_partners
            WHERE project_id = v_project_id
            AND chain_id = v_chain_id
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
            
            -- ✅ 每个level都独立从payable_cost（司机应收）开始计算
            v_base_amount := v_base_amount;  -- 使用payable_cost（已在外层赋值）
            
            -- ✅ 根据计算方法计算应付金额（支持三种方法）
            IF v_project_partners.calculation_method = 'fixed_price' THEN
                -- 直接定价法：有效数量 × 单价
                IF v_effective_quantity IS NOT NULL AND v_effective_quantity > 0 
                   AND v_project_partners.unit_price IS NOT NULL AND v_project_partners.unit_price > 0 THEN
                    v_payable_amount := v_effective_quantity * v_project_partners.unit_price;
                ELSE
                    v_payable_amount := 0;
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
            
            -- 插入新的成本记录
            INSERT INTO logistics_partner_costs (
                logistics_record_id,
                partner_id,
                level,
                base_amount,
                payable_amount,
                tax_rate,
                is_manually_modified
            ) VALUES (
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,  -- 对于直接定价法，base_amount 仍然记录 payable_cost（用于参考）
                v_payable_amount,
                v_project_partners.tax_rate,
                false
            );
            
            -- ✅ 不更新v_base_amount，每个level都独立从payable_cost计算
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', format('批量重算完成：总计%s条，成功%s条，跳过%s条，保护手工值%s个', 
            v_total_count, v_updated_count, v_skipped_count, v_protected_count),
        'total_count', v_total_count,
        'updated_count', v_updated_count,
        'skipped_count', v_skipped_count,
        'protected_count', v_protected_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '批量重算失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.batch_recalculate_partner_costs_1120 IS '
批量重算合作方成本（保护手工修改的值，支持三种计算方法）
逻辑：
1. 删除 is_manually_modified=false 的记录（系统计算的）
2. 保留 is_manually_modified=true 的记录（手工修改的）
3. 遍历所有合作方，如果is_manually_modified=true则跳过
4. 每个level独立从payable_cost（司机应收）开始计算
5. 支持三种计算方法：
   - fixed_price: 有效数量 × 单价
   - profit: 基础金额 + (利润 × 装货重量)
   - tax: 基础金额 / (1 - 税点)
6. 不级联，每个level的base_amount都是payable_cost
更新日期：2025-11-20';

-- ============================================================================
-- 第二步：更新 trigger_recalc_on_payable_cost_change 触发器函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_recalc_on_payable_cost_change_1120()
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
    v_effective_quantity NUMERIC;  -- 新增：有效数量
    v_project_partners RECORD;
BEGIN
    -- 只在 payable_cost 改变时触发
    IF OLD.payable_cost IS NOT DISTINCT FROM NEW.payable_cost THEN
        RETURN NEW;  -- 司机应收没变，不处理
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
    
    RAISE NOTICE '📌 司机应收改变：¥% → ¥%，触发自动重算', OLD.payable_cost, NEW.payable_cost;
    
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
    
    -- 如果有效数量为空，重新计算
    IF v_effective_quantity IS NULL OR v_effective_quantity = 0 THEN
        v_effective_quantity := public.get_effective_quantity_for_record_1120(
            v_loading_weight,
            v_unloading_weight,
            NEW.project_id,
            NEW.chain_id
        );
    END IF;
    
    -- ✅ 步骤4：重新计算所有合作方成本（每个level独立从payable_cost计算）
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
        
        -- ✅ 每个level都从payable_cost（司机应收）开始计算
        v_base_amount := NEW.payable_cost;
        
        -- ✅ 根据计算方法计算应付金额（支持三种方法）
        IF v_project_partners.calculation_method = 'fixed_price' THEN
            -- 直接定价法：有效数量 × 单价（不依赖 payable_cost）
            IF v_effective_quantity IS NOT NULL AND v_effective_quantity > 0 
               AND v_project_partners.unit_price IS NOT NULL AND v_project_partners.unit_price > 0 THEN
                v_payable_amount := v_effective_quantity * v_project_partners.unit_price;
            ELSE
                v_payable_amount := 0;
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

COMMENT ON FUNCTION public.auto_recalc_on_payable_cost_change_1120 IS '触发器函数：司机应收改变时自动重算合作方成本（每个level独立从payable_cost计算，保护手工值，支持三种计算方法）更新日期：2025-11-20';

-- ============================================================================
-- 完成提示
-- ============================================================================

-- ============================================================================
-- 更新触发器：使用 _1120 版本的函数
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_recalc_on_payable_cost_change ON logistics_records;

CREATE TRIGGER trigger_recalc_on_payable_cost_change
    AFTER UPDATE OF payable_cost ON logistics_records
    FOR EACH ROW
    WHEN (OLD.payable_cost IS DISTINCT FROM NEW.payable_cost)
    EXECUTE FUNCTION auto_recalc_on_payable_cost_change_1120();

COMMENT ON TRIGGER trigger_recalc_on_payable_cost_change ON logistics_records IS '司机应收改变时自动重算合作方成本（使用 _1120 版本函数）';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 重算函数已更新，支持直接定价法！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '更新的函数：';
    RAISE NOTICE '  1. batch_recalculate_partner_costs_1120';
    RAISE NOTICE '  2. auto_recalc_on_payable_cost_change_1120';
    RAISE NOTICE '';
    RAISE NOTICE '支持的计算方法：';
    RAISE NOTICE '  • fixed_price: 有效数量 × 单价';
    RAISE NOTICE '  • profit: 基础金额 + (利润 × 装货重量)';
    RAISE NOTICE '  • tax: 基础金额 / (1 - 税点)';
    RAISE NOTICE '';
    RAISE NOTICE '触发器已更新：';
    RAISE NOTICE '  • trigger_recalc_on_payable_cost_change';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END;
$$;

