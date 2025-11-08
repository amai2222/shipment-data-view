-- ============================================================================
-- 创建批量重算合作方成本函数（保护手工修改的值）
-- 创建日期：2025-11-06
-- 用途：对账管理页面的"一键重算"功能
-- ============================================================================

-- ============================================================================
-- 创建批量重算函数
-- ============================================================================

-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS batch_recalculate_partner_costs(uuid[]) CASCADE;

CREATE OR REPLACE FUNCTION batch_recalculate_partner_costs(
    p_record_ids UUID[]  -- 要重算的运单ID数组
)
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
    v_chain_id UUID;
    v_project_id UUID;
    v_manually_modified_costs JSONB;
    v_manual_value NUMERIC;
    v_is_manual BOOLEAN;
    v_has_paid_invoice BOOLEAN;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_operator_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以重算成本'
        );
    END IF;
    
    -- 遍历每个运单
    FOR v_record_id IN SELECT unnest(p_record_ids)
    LOOP
        v_total_count := v_total_count + 1;
        v_manually_modified_costs := NULL;
        
        -- 检查运单是否已付款或已开票
        SELECT 
            EXISTS (
                SELECT 1 FROM logistics_partner_costs
                WHERE logistics_record_id = v_record_id
                AND (payment_status = 'Paid' OR invoice_status = 'Invoiced')
            )
        INTO v_has_paid_invoice;
        
        -- 跳过已付款或已开票的运单
        IF v_has_paid_invoice THEN
            v_skipped_count := v_skipped_count + 1;
            RAISE NOTICE '⚠️  运单已付款或已开票，跳过重算';
            CONTINUE;
        END IF;
        
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
        
        -- 获取运单基础信息
        SELECT 
            chain_id,
            project_id,
            current_cost + COALESCE(extra_cost, 0),
            loading_weight,
            unloading_weight
        INTO v_chain_id, v_project_id, v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        IF v_chain_id IS NULL OR v_project_id IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;
        
        -- （已在上面删除了系统计算的记录）
        
        -- ✅ 关键步骤2：重新计算所有合作方成本（每个level独立从payable_cost计算）
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate
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
            
            -- 插入新的成本记录
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
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,  -- 都是payable_cost
                v_payable_amount,
                v_project_partners.tax_rate,
                false,
                auth.uid()
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

COMMENT ON FUNCTION batch_recalculate_partner_costs IS '
批量重算合作方成本（保护手工修改的值）
逻辑：
1. 删除 is_manually_modified=false 的记录（系统计算的）
2. 保留 is_manually_modified=true 的记录（手工修改的）
3. 遍历所有合作方，如果is_manually_modified=true则跳过
4. 每个level独立从payable_cost（司机应收）开始计算
5. 不级联，每个level的base_amount都是payable_cost
';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ batch_recalculate_partner_costs 函数已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '功能：批量重算合作方成本';
    RAISE NOTICE '';
    RAISE NOTICE '重算逻辑：';
    RAISE NOTICE '  ✓ 删除 is_manually_modified=false 的记录';
    RAISE NOTICE '  ✓ 保留 is_manually_modified=true 的记录';
    RAISE NOTICE '  ✓ 每个level独立从payable_cost计算';
    RAISE NOTICE '  ✓ 跳过is_manually_modified=true的合作方';
    RAISE NOTICE '  ✓ 不级联，每个level的base都是payable_cost';
    RAISE NOTICE '';
    RAISE NOTICE '使用：';
    RAISE NOTICE '  SELECT batch_recalculate_partner_costs(ARRAY[''uuid1'', ''uuid2'']);';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

