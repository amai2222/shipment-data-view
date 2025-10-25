-- ==========================================
-- 修复合作链路修改功能 - 增加成本重算逻辑
-- ==========================================
-- 创建时间: 2025-10-25
-- 功能: 
--   1. 修改运单的合作链路
--   2. 删除该运单的旧成本记录
--   3. 根据新链路重新计算所有合作方成本
--   4. 插入新的成本记录
-- ==========================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.modify_logistics_record_chain_with_recalc(UUID, TEXT);

-- 创建新的修改合作链路函数（包含成本重算）
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
    v_partner RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_effective_weight NUMERIC;
    v_inserted_count INTEGER := 0;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以修改合作链路'
        );
    END IF;
    
    -- 获取运单信息（包括支付状态和开票状态）
    SELECT 
        project_id, 
        chain_name, 
        payable_cost,
        loading_weight,
        unloading_weight,
        payment_status,
        invoice_status
    INTO 
        v_project_id, 
        v_old_chain_name, 
        v_base_amount,
        v_loading_weight,
        v_unloading_weight,
        v_payment_status,
        v_invoice_status
    FROM public.logistics_records
    WHERE id = p_record_id;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '运单记录不存在'
        );
    END IF;
    
    -- 检查支付状态：只有未支付的运单才能修改
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
    
    -- 检查开票状态：只有未开票的运单才能修改
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
    
    -- 第一步：删除该运单的旧成本记录
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;
    
    -- 第二步：更新运单的链路信息
    UPDATE public.logistics_records
    SET 
        chain_id = v_chain_id,
        chain_name = p_chain_name,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 第三步：根据新链路重新计算并插入合作方成本
    -- 计算有效重量（卸货重量优先，否则使用装货重量）
    v_effective_weight := COALESCE(v_unloading_weight, v_loading_weight, 0);
    
    -- 遍历新链路的所有合作方
    FOR v_partner IN
        SELECT 
            pp.partner_id,
            p.name as partner_name,
            pb.full_name,
            pb.bank_account,
            pb.bank_name,
            pb.branch_name,
            pp.level,
            pp.calculation_method,
            pp.tax_rate,
            pp.profit_rate
        FROM public.project_partners pp
        LEFT JOIN public.partners p ON pp.partner_id = p.id
        LEFT JOIN public.partner_bank_details pb ON pp.partner_id = pb.partner_id
        WHERE pp.project_id = v_project_id
        AND pp.chain_id = v_chain_id
        ORDER BY pp.level DESC
    LOOP
        -- 根据计算方法计算应付金额
        IF v_partner.calculation_method = '税点法' THEN
            -- 税点法: 应付金额 = 基础金额 / (1 - 税点)
            v_payable_amount := v_base_amount / (1 - COALESCE(v_partner.tax_rate, 0));
        ELSIF v_partner.calculation_method = '利润法' THEN
            -- 利润法: 应付金额 = 基础金额 + (利润率 × 有效重量)
            v_payable_amount := v_base_amount + (COALESCE(v_partner.profit_rate, 0) * v_effective_weight);
        ELSE
            -- 默认使用基础金额
            v_payable_amount := v_base_amount;
        END IF;
        
        -- 插入新的成本记录
        INSERT INTO public.logistics_partner_costs (
            logistics_record_id,
            partner_id,
            partner_name,
            full_name,
            bank_account,
            bank_name,
            branch_name,
            level,
            payable_amount,
            created_at,
            updated_at
        ) VALUES (
            p_record_id,
            v_partner.partner_id,
            v_partner.partner_name,
            v_partner.full_name,
            v_partner.bank_account,
            v_partner.bank_name,
            v_partner.branch_name,
            v_partner.level,
            v_payable_amount,
            NOW(),
            NOW()
        );
        
        v_inserted_count := v_inserted_count + 1;
        
        -- 更新基础金额为当前层级的应付金额（用于下一层级计算）
        v_base_amount := v_payable_amount;
    END LOOP;
    
    -- 返回成功结果
    RETURN json_build_object(
        'success', true,
        'message', '合作链路修改成功，已重新计算成本',
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数说明
COMMENT ON FUNCTION public.modify_logistics_record_chain_with_recalc IS '修改运单合作链路并重新计算所有合作方成本';

