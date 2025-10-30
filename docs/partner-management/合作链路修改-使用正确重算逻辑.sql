-- ==========================================
-- 合作链路修改功能 - 使用标准重算逻辑
-- 参考: recalculate_costs_for_chain 函数
-- ==========================================

DROP FUNCTION IF EXISTS public.modify_logistics_record_chain_with_recalc(UUID, TEXT);
DROP FUNCTION IF EXISTS public.is_finance_operator_or_admin();

CREATE OR REPLACE FUNCTION public.is_finance_operator_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role::text INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN user_role IN ('admin', 'finance', 'operator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
BEGIN
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object('success', false, 'message', '权限不足');
    END IF;
    
    -- 获取运单信息
    SELECT 
        lr.project_id, 
        pc.chain_name,
        lr.current_cost + COALESCE(lr.extra_cost, 0),  -- ✅ 基础金额 = current_cost + extra_cost
        lr.loading_weight,
        lr.unloading_weight,
        lr.payment_status,
        lr.invoice_status
    INTO 
        v_project_id, v_old_chain_name, v_base_amount,
        v_loading_weight, v_unloading_weight,
        v_payment_status, v_invoice_status
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE lr.id = p_record_id;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', '运单记录不存在');
    END IF;
    
    IF v_payment_status != 'Unpaid' THEN
        RETURN json_build_object('success', false, 'message', '只有未支付状态的运单才能修改');
    END IF;
    
    IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
        RETURN json_build_object('success', false, 'message', '只有未开票状态的运单才能修改');
    END IF;
    
    SELECT id INTO v_chain_id
    FROM public.partner_chains
    WHERE project_id = v_project_id AND chain_name = p_chain_name
    LIMIT 1;
    
    IF v_chain_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', '指定的合作链路不存在');
    END IF;
    
    -- 删除旧成本记录
    DELETE FROM public.logistics_partner_costs WHERE logistics_record_id = p_record_id;
    
    -- 更新运单链路
    UPDATE public.logistics_records
    SET chain_id = v_chain_id, updated_at = NOW()
    WHERE id = p_record_id;
    
    -- ✅ 使用标准重算逻辑：从低层级到高层级，每层使用同一个基础金额
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
        ORDER BY level ASC  -- ✅ 从低到高
    LOOP
        -- ✅ 计算应付金额
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
        
        -- ✅ 插入新的成本记录
        INSERT INTO logistics_partner_costs (
            logistics_record_id,
            partner_id,
            level,
            base_amount,
            payable_amount,
            tax_rate,
            user_id
        ) VALUES (
            p_record_id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,  -- ✅ 每层使用同一个基础金额
            v_payable_amount,
            v_project_partners.tax_rate,
            auth.uid()
        );
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', '合作链路修改成功',
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ 修复完成！使用标准重算逻辑' as 状态;

