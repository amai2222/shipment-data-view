-- 修复：修改链路时保护手动修改的合作方成本
-- 问题：modify_logistics_record_chain_with_recalc 会直接删除所有成本记录，包括手动修改的值
-- 解决：在删除前保存手动修改的值，重算后恢复

BEGIN;

CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain_with_recalc(
    p_record_id UUID,
    p_chain_name TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
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
    v_manually_modified_costs JSONB;  -- 保存手动修改的值
    v_manual_cost RECORD;
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
            'message', '只有未支付状态的运单才能修改合作链路。当前付款状态：' || 
                CASE 
                    WHEN v_payment_status = 'Processing' THEN '已申请支付'
                    WHEN v_payment_status = 'Paid' THEN '已完成支付'
                    ELSE v_payment_status
                END
        );
    END IF;
    
    -- 检查开票状态
    IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未开票状态的运单才能修改合作链路。当前开票状态：' || 
                CASE 
                    WHEN v_invoice_status = 'Processing' THEN '开票中'
                    WHEN v_invoice_status = 'Invoiced' THEN '已开票'
                    ELSE v_invoice_status
                END
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
    
    -- ✅ 关键修复：保存所有手动修改过的合作方成本
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
    
    -- 删除该运单的旧成本记录
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;
    
    -- 更新运单的链路信息
    UPDATE public.logistics_records
    SET 
        chain_id = v_chain_id,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 根据新链路重新计算并插入合作方成本
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
            -- 利润法
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
        
        -- ✅ 关键修复：检查是否有手动修改的值，如果有则使用手动值
        DECLARE
            v_manual_value NUMERIC := NULL;
            v_is_manual BOOLEAN := false;
        BEGIN
            IF v_manually_modified_costs IS NOT NULL THEN
                -- 从保存的手动值中查找匹配的合作方
                SELECT (elem->>'payable_amount')::NUMERIC
                INTO v_manual_value
                FROM jsonb_array_elements(v_manually_modified_costs) AS elem
                WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
                AND (elem->>'level')::INTEGER = v_project_partners.level
                LIMIT 1;
                
                IF v_manual_value IS NOT NULL THEN
                    v_payable_amount := v_manual_value;
                    v_is_manual := true;
                    RAISE NOTICE '保护手动修改值：合作方(level=%) 使用手动值 ¥%', v_project_partners.level, v_manual_value;
                END IF;
            END IF;
        END;
        
        -- 插入新的成本记录
        INSERT INTO public.logistics_partner_costs (
            logistics_record_id,
            partner_id,
            level,
            base_amount,
            payable_amount,
            tax_rate,
            user_id,
            is_manually_modified  -- ✅ 保留手动修改标记
        ) VALUES (
            p_record_id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,
            v_payable_amount,
            v_project_partners.tax_rate,
            auth.uid(),
            v_is_manual  -- ✅ 如果是手动值则标记为true
        );
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', '合作链路修改成功，已重新计算成本',
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count,
        'protected_manual_costs', COALESCE(jsonb_array_length(v_manually_modified_costs), 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.modify_logistics_record_chain_with_recalc IS '
修改运单合作链路并重新计算所有合作方成本
改进：
1. 在删除前保存所有is_manually_modified=true的成本记录
2. 重新计算后，如果同一合作方(partner_id+level)仍存在，则恢复手动修改的值
3. 保持is_manually_modified标记
这样可以保护用户的手动修改，即使修改链路也不会丢失
';

COMMIT;

