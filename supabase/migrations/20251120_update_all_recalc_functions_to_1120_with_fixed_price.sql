-- ============================================================================
-- 统一更新所有重算函数：_1120 版本 + 定价法支持
-- 日期：2025-11-20
-- 说明：
--   1. 统一所有重算函数后缀为 _1120
--   2. 添加定价法（fixed_price）支持
--   3. 添加三重保护机制：运单状态保护、手工修改保护、独立计算保护
--   4. 支持有效数量（effective_quantity）和单价（unit_price）
-- ============================================================================

-- ============================================================================
-- 第一个函数：recalculate_costs_for_chain_1120
-- 功能：重新计算指定链路的所有运单成本
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain_1120(
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
    v_skipped_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_effective_quantity NUMERIC;
    v_record_status RECORD;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        -- ✅ 保护逻辑：只对【未付款 且 未开票 且 未收款】的运单重算
        SELECT 
            payment_status,
            invoice_status,
            receipt_status
        INTO v_record_status
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 如果不满足"未付款 且 未开票 且 未收款"的条件，跳过重算
        IF v_record_status.payment_status != 'Unpaid' 
           OR (v_record_status.invoice_status IS NOT NULL AND v_record_status.invoice_status != 'Uninvoiced')
           OR (v_record_status.receipt_status IS NOT NULL AND v_record_status.receipt_status = 'Received') THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;  -- 跳过该运单
        END IF;
        
        -- 通过检查，允许重算（状态：未付款 AND 未开票 AND 未收款）
        
        -- 获取运单的基础数据
        SELECT 
            payable_cost,  -- 使用 payable_cost（司机应收）
            loading_weight,
            unloading_weight,
            effective_quantity
        INTO v_base_amount, v_loading_weight, v_unloading_weight, v_effective_quantity
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 如果有效数量为空或为0，重新计算
        IF v_effective_quantity IS NULL OR v_effective_quantity = 0 THEN
            v_effective_quantity := public.get_effective_quantity_for_record_1120(
                v_loading_weight,
                v_unloading_weight,
                p_project_id,
                p_chain_id
            );
        END IF;
        
        -- 删除旧的合作方成本记录（只删除系统计算的）
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id
        AND COALESCE(is_manually_modified, false) = false;
        
        -- 根据最新的 project_partners 配置重新计算
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate,
                unit_price
            FROM project_partners
            WHERE project_id = p_project_id
              AND chain_id = p_chain_id
            ORDER BY level ASC
        LOOP
            -- 检查该合作方是否被手工修改过
            IF EXISTS (
                SELECT 1 FROM logistics_partner_costs
                WHERE logistics_record_id = v_record_id
                AND partner_id = v_project_partners.partner_id
                AND level = v_project_partners.level
                AND is_manually_modified = true
            ) THEN
                -- 跳过手工修改的记录
                CONTINUE;
            END IF;
            
            -- 根据计算方法计算应付金额
            IF v_project_partners.calculation_method = 'fixed_price' THEN
                -- 定价法：有效数量 × 单价
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
                -- 税点法（默认）
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
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                false
            );
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.recalculate_costs_for_chain_1120 IS '重新计算指定链路的所有运单成本（_1120版本，支持定价法+三重保护）';

-- ============================================================================
-- 第二个函数：recalculate_costs_for_chain_safe_1120
-- 功能：安全重算指定链路的运单成本（保护手工修改+跳过已付款）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain_safe_1120(
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
    v_total_records INTEGER := 0;
    v_updated_records INTEGER := 0;
    v_skipped_records INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_effective_quantity NUMERIC;
    v_manually_modified_costs JSONB;
    v_record_status RECORD;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        v_total_records := v_total_records + 1;
        
        -- ✅ 保护逻辑：只对【未付款 且 未开票 且 未收款】的运单重算
        SELECT 
            payment_status,
            invoice_status,
            receipt_status
        INTO v_record_status
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 如果是安全模式(p_only_unpaid=TRUE)，检查运单状态
        -- 不满足"未付款 且 未开票 且 未收款"的条件时，跳过重算
        IF p_only_unpaid AND (
            v_record_status.payment_status != 'Unpaid' 
            OR (v_record_status.invoice_status IS NOT NULL AND v_record_status.invoice_status != 'Uninvoiced')
            OR (v_record_status.receipt_status IS NOT NULL AND v_record_status.receipt_status = 'Received')
        ) THEN
            v_skipped_records := v_skipped_records + 1;
            CONTINUE;  -- 跳过该运单
        END IF;
        
        -- 通过检查，允许重算（状态：未付款 AND 未开票 AND 未收款）
        
        -- 保存所有手工修改的记录
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
        
        -- 获取运单的基础数据
        SELECT 
            payable_cost,
            loading_weight,
            unloading_weight,
            effective_quantity
        INTO v_base_amount, v_loading_weight, v_unloading_weight, v_effective_quantity
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 如果有效数量为空或为0，重新计算
        IF v_effective_quantity IS NULL OR v_effective_quantity = 0 THEN
            v_effective_quantity := public.get_effective_quantity_for_record_1120(
                v_loading_weight,
                v_unloading_weight,
                p_project_id,
                p_chain_id
            );
        END IF;
        
        -- 删除旧的合作方成本记录（只删除系统计算的）
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id
        AND COALESCE(is_manually_modified, false) = false;
        
        -- 根据最新的 project_partners 配置重新计算
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate,
                unit_price
            FROM project_partners
            WHERE project_id = p_project_id
              AND chain_id = p_chain_id
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
                    v_protected_count := v_protected_count + 1;
                    CONTINUE;
                END IF;
            END IF;
            
            -- 根据计算方法计算应付金额
            IF v_project_partners.calculation_method = 'fixed_price' THEN
                -- 定价法
                IF v_effective_quantity IS NOT NULL AND v_effective_quantity > 0 
                   AND v_project_partners.unit_price IS NOT NULL AND v_project_partners.unit_price > 0 THEN
                    v_payable_amount := v_effective_quantity * v_project_partners.unit_price;
                ELSE
                    v_payable_amount := 0;
                END IF;
            ELSIF v_project_partners.calculation_method = 'profit' THEN
                -- 利润法
                IF v_loading_weight IS NOT NULL AND v_loading_weight > 0 THEN
                    v_payable_amount := v_base_amount + (COALESCE(v_project_partners.profit_rate, 0) * v_loading_weight);
                ELSE
                    v_payable_amount := v_base_amount + COALESCE(v_project_partners.profit_rate, 0);
                END IF;
            ELSE
                -- 税点法
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
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                false
            );
        END LOOP;
        
        v_updated_records := v_updated_records + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'total_records', v_total_records,
        'updated_records', v_updated_records,
        'skipped_records', v_skipped_records,
        'protected_count', v_protected_count,
        'message', format('总计 %s 条运单，更新 %s 条，跳过 %s 条（已付款/已开票/已收款），保护 %s 个手工值', 
            v_total_records, v_updated_records, v_skipped_records, v_protected_count)
    );
END;
$$;

COMMENT ON FUNCTION public.recalculate_costs_for_chain_safe_1120 IS '安全重算指定链路的运单成本（_1120版本，支持定价法+三重保护+可选跳过已付款）';

-- ============================================================================
-- 第三个函数：recalculate_costs_for_project_1120
-- 功能：重新计算整个项目的所有运单成本
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_project_1120(
    p_project_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_chain RECORD;
    v_total_updated INTEGER := 0;
    v_total_skipped INTEGER := 0;
    v_result JSON;
BEGIN
    -- 遍历项目的所有链路
    FOR v_chain IN 
        SELECT DISTINCT chain_id 
        FROM project_partners 
        WHERE project_id = p_project_id
    LOOP
        -- 使用安全重算函数（跳过已付款运单）
        v_result := public.recalculate_costs_for_chain_safe_1120(p_project_id, v_chain.chain_id, TRUE);
        v_total_updated := v_total_updated + (v_result->>'updated_records')::INTEGER;
        v_total_skipped := v_total_skipped + (v_result->>'skipped_records')::INTEGER;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'total_updated', v_total_updated,
        'total_skipped', v_total_skipped,
        'message', format('项目重算完成：更新 %s 条运单，跳过 %s 条（已付款/已开票/已收款）', v_total_updated, v_total_skipped)
    );
END;
$$;

COMMENT ON FUNCTION public.recalculate_costs_for_project_1120 IS '重新计算整个项目的所有运单成本（_1120版本，支持定价法+三重保护）';

-- ============================================================================
-- 第四个函数：auto_recalc_on_project_partner_change_1120
-- 功能：项目合作方变更时自动重算（触发器函数）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_recalc_on_project_partner_change_1120()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSON;
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
           OLD.profit_rate IS DISTINCT FROM NEW.profit_rate OR
           OLD.unit_price IS DISTINCT FROM NEW.unit_price THEN  -- 新增：单价变化时重算
            v_should_recalc := TRUE;
        END IF;
    END IF;
    
    -- 执行重算（使用安全模式，跳过已付款/已开票/已收款运单）
    IF v_should_recalc THEN
        IF TG_OP = 'DELETE' THEN
            v_result := public.recalculate_costs_for_chain_safe_1120(OLD.project_id, OLD.chain_id, TRUE);
            RAISE NOTICE '已删除合作方，重算链路 % 的运单成本：%', OLD.chain_id, v_result->>'message';
            RETURN OLD;
        ELSE
            v_result := public.recalculate_costs_for_chain_safe_1120(NEW.project_id, NEW.chain_id, TRUE);
            RAISE NOTICE '已更新合作方配置，重算链路 % 的运单成本：%', NEW.chain_id, v_result->>'message';
            RETURN NEW;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_recalc_on_project_partner_change_1120 IS '自动重算项目合作方变更时的运单成本（_1120版本，支持定价法+三重保护）';

-- ============================================================================
-- 更新触发器：使用 _1120 版本的函数
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_recalc_partner_costs ON public.project_partners;

CREATE TRIGGER trigger_auto_recalc_partner_costs
    AFTER INSERT OR UPDATE OR DELETE ON public.project_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_recalc_on_project_partner_change_1120();

-- ============================================================================
-- 验证信息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 所有重算函数已更新为 _1120 版本';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '更新的函数：';
    RAISE NOTICE '  1. recalculate_costs_for_chain_1120';
    RAISE NOTICE '  2. recalculate_costs_for_chain_safe_1120';
    RAISE NOTICE '  3. recalculate_costs_for_project_1120';
    RAISE NOTICE '  4. auto_recalc_on_project_partner_change_1120';
    RAISE NOTICE '';
    RAISE NOTICE '新增功能：';
    RAISE NOTICE '  ✅ 支持定价法（fixed_price）';
    RAISE NOTICE '  ✅ 支持有效数量（effective_quantity）';
    RAISE NOTICE '  ✅ 支持单价（unit_price）';
    RAISE NOTICE '';
    RAISE NOTICE '保护机制：';
    RAISE NOTICE '  ✅ 运单状态保护（已付款/已开票/已收款）';
    RAISE NOTICE '  ✅ 手工修改保护（is_manually_modified）';
    RAISE NOTICE '  ✅ 独立计算保护（定价法不依赖基础运价）';
    RAISE NOTICE '';
    RAISE NOTICE '触发器已更新：';
    RAISE NOTICE '  ✅ trigger_auto_recalc_partner_costs';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

