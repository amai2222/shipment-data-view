-- ============================================================
-- 全面保护手动修改的合作方成本
-- ============================================================
-- 问题：
-- 1. modify_logistics_record_chain_with_recalc：修改链路时会删除所有成本记录
-- 2. recalculate_costs_for_chain_safe：自动重算时会覆盖所有未付款运单的成本
-- 3. 都没有检查 is_manually_modified 标记
--
-- 解决：
-- 1. 在删除前保存所有 is_manually_modified=true 的值
-- 2. 重算后恢复手动修改的值
-- 3. 保持 is_manually_modified 标记
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 修复：modify_logistics_record_chain_with_recalc
--    用户主动修改链路时的保护逻辑
-- ============================================================

CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain_with_recalc(
    p_record_id UUID,
    p_chain_name TEXT
)
RETURNS JSON AS $$
DECLARE
    v_can_access BOOLEAN;
    v_project_id UUID;
    v_chain_id UUID;
    v_old_chain_name TEXT;
    v_payment_status TEXT;
    v_invoice_status TEXT;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_inserted_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_manually_modified_costs JSONB;
    v_manual_value NUMERIC;  -- ✅ 移到外部声明
    v_is_manual BOOLEAN;     -- ✅ 移到外部声明
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以修改合作链路'
        );
    END IF;
    
    -- 获取运单信息
    SELECT 
        lr.project_id, 
        pc.chain_name,
        lr.current_cost + COALESCE(lr.extra_cost, 0),
        lr.loading_weight,
        lr.unloading_weight,
        lr.payment_status,
        lr.invoice_status
    INTO 
        v_project_id, 
        v_old_chain_name, 
        v_base_amount,
        v_loading_weight,
        v_unloading_weight,
        v_payment_status,
        v_invoice_status
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE lr.id = p_record_id;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '运单记录不存在'
        );
    END IF;
    
    -- 检查支付状态
    IF v_payment_status != 'Unpaid' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未支付状态的运单才能修改合作链路'
        );
    END IF;
    
    -- 检查开票状态
    IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未开票状态的运单才能修改合作链路'
        );
    END IF;
    
    -- 查找新的合作链路ID
    SELECT id INTO v_chain_id
    FROM public.partner_chains
    WHERE project_id = v_project_id
    AND chain_name = p_chain_name
    LIMIT 1;
    
    IF v_chain_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '指定的合作链路不存在'
        );
    END IF;
    
    -- ✅ 关键修复：保存所有手动修改的成本（按partner_id + level匹配）
    SELECT json_agg(
        json_build_object(
            'partner_id', partner_id,
            'level', level,
            'payable_amount', payable_amount
        )
    )
    INTO v_manually_modified_costs
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id
    AND is_manually_modified = true;
    
    RAISE NOTICE '📌 保存手动修改的成本：%', COALESCE(jsonb_array_length(v_manually_modified_costs), 0);
    
    -- 删除旧成本记录
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;
    
    -- 更新链路
    UPDATE public.logistics_records
    SET 
        chain_id = v_chain_id,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 重新计算并插入合作方成本
    FOR v_project_partners IN
        SELECT 
            pp.partner_id,
            pp.level,
            pp.calculation_method,
            pp.tax_rate,
            pp.profit_rate
        FROM public.project_partners pp
        WHERE pp.project_id = v_project_id
        AND pp.chain_id = v_chain_id
        ORDER BY pp.level ASC
    LOOP
        -- 初始值：按系统规则计算
        IF v_project_partners.calculation_method = 'profit' THEN
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
        
        -- ✅ 关键修复：检查该合作方是否有手动修改的值
        v_manual_value := NULL;
        v_is_manual := false;
        
        IF v_manually_modified_costs IS NOT NULL THEN
            SELECT (elem->>'payable_amount')::NUMERIC
            INTO v_manual_value
            FROM jsonb_array_elements(v_manually_modified_costs) AS elem
            WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
            AND (elem->>'level')::INTEGER = v_project_partners.level
            LIMIT 1;
            
            IF v_manual_value IS NOT NULL THEN
                v_payable_amount := v_manual_value;
                v_is_manual := true;
                v_protected_count := v_protected_count + 1;
                RAISE NOTICE '✅ 保护手动值：合作方(level=%) 恢复为 ¥%', v_project_partners.level, v_manual_value;
            END IF;
        END IF;
        
        -- 插入成本记录
        INSERT INTO public.logistics_partner_costs (
            logistics_record_id,
            partner_id,
            level,
            base_amount,
            payable_amount,
            tax_rate,
            user_id,
            is_manually_modified
        ) VALUES (
            p_record_id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,
            v_payable_amount,
            v_project_partners.tax_rate,
            auth.uid(),
            v_is_manual  -- ✅ 保持手动修改标记
        );
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', format('链路修改成功，重算%s个合作方，保护%s个手动值', v_inserted_count, v_protected_count),
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count,
        'protected_manual_costs', v_protected_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.modify_logistics_record_chain_with_recalc IS '
修改运单合作链路并重新计算成本（保护手动修改的值）
改进：
1. 删除前保存所有 is_manually_modified=true 的值
2. 重新计算后，如果同一合作方（partner_id+level）仍存在，恢复手动值
3. 保持 is_manually_modified 标记
4. 只有未付款且未开票的运单才能修改
';

-- ============================================================
-- 2. 修复：recalculate_costs_for_chain_safe
--    项目配置变更时的自动重算保护逻辑
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain_safe(
    p_project_id UUID,
    p_chain_id UUID,
    p_only_unpaid BOOLEAN DEFAULT TRUE
)
RETURNS JSON AS $$
DECLARE
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_total_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_has_paid_status BOOLEAN;
    v_manually_modified_costs JSONB := NULL;  -- 每个运单的手动修改值
    v_manual_value NUMERIC;  -- ✅ 移到外部声明
    v_is_manual BOOLEAN;     -- ✅ 移到外部声明
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        v_total_count := v_total_count + 1;
        v_manually_modified_costs := NULL;  -- 重置为NULL，准备保存当前运单的手动值
        
        -- 检查是否有已付款的成本记录
        SELECT EXISTS (
            SELECT 1 FROM logistics_partner_costs
            WHERE logistics_record_id = v_record_id
              AND payment_status = 'Paid'
        ) INTO v_has_paid_status;
        
        -- 如果是安全模式且有已付款记录，跳过
        IF p_only_unpaid AND v_has_paid_status THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;
        
        -- ✅ 关键修复：保存该运单的手动修改成本
        SELECT json_agg(
            json_build_object(
                'partner_id', partner_id,
                'level', level,
                'payable_amount', payable_amount
            )
        )
        INTO v_manually_modified_costs
        FROM public.logistics_partner_costs
        WHERE logistics_record_id = v_record_id
        AND is_manually_modified = true;
        
        -- 获取运单基础数据
        SELECT 
            current_cost + COALESCE(extra_cost, 0) as base,
            loading_weight,
            unloading_weight
        INTO v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 删除旧成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 重新计算并插入
        FOR v_project_partners IN
            SELECT 
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate
            FROM project_partners
            WHERE project_id = p_project_id
              AND chain_id = p_chain_id
            ORDER BY level ASC
        LOOP
            -- 按系统规则计算
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
            
            -- ✅ 检查是否有手动修改的值
            v_manual_value := NULL;
            v_is_manual := false;
            
            IF v_manually_modified_costs IS NOT NULL THEN
                SELECT (elem->>'payable_amount')::NUMERIC
                INTO v_manual_value
                FROM jsonb_array_elements(v_manually_modified_costs) AS elem
                WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
                AND (elem->>'level')::INTEGER = v_project_partners.level
                LIMIT 1;
                
                IF v_manual_value IS NOT NULL THEN
                    v_payable_amount := v_manual_value;
                    v_is_manual := true;
                    v_protected_count := v_protected_count + 1;
                END IF;
            END IF;
            
            -- 插入成本记录
            INSERT INTO logistics_partner_costs (
                logistics_record_id,
                partner_id,
                level,
                base_amount,
                payable_amount,
                tax_rate,
                user_id,
                is_manually_modified
            ) VALUES (
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                auth.uid(),
                v_is_manual
            );
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'total_records', v_total_count,
        'updated_count', v_updated_count,
        'skipped_count', v_skipped_count,
        'protected_manual_costs', v_protected_count,
        'message', format('成功重算%s条运单，跳过%s条（已付款），保护%s个手动值', v_updated_count, v_skipped_count, v_protected_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.recalculate_costs_for_chain_safe IS '
安全重算链路成本（保护手动修改的值）
保护逻辑：
1. 只重算未付款的运单（已付款的完全跳过）
2. 保存每个运单的 is_manually_modified=true 的成本值
3. 重算后恢复手动修改的值
4. 保持 is_manually_modified 标记
';

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 手动成本保护功能已启用';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '保护范围：';
    RAISE NOTICE '  ✓ 用户手动修改的合作方应收';
    RAISE NOTICE '  ✓ 修改链路时保护手动值';
    RAISE NOTICE '  ✓ 项目配置变更时保护手动值';
    RAISE NOTICE '';
    RAISE NOTICE '保护逻辑：';
    RAISE NOTICE '  1. 删除前：保存 is_manually_modified=true 的值';
    RAISE NOTICE '  2. 重算后：按 partner_id+level 匹配恢复';
    RAISE NOTICE '  3. 标记保持：恢复的值仍标记为手动修改';
    RAISE NOTICE '';
    RAISE NOTICE '适用场景：';
    RAISE NOTICE '  • 用户修改链路：手动值会被保护';
    RAISE NOTICE '  • 管理员改配置：手动值会被保护';
    RAISE NOTICE '  • 用户点"恢复默认"：主动清除is_manually_modified';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

