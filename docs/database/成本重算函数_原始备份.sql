-- ============================================================================
-- 成本重算函数原始备份
-- ============================================================================
-- 备份日期: 2025-10-26
-- 目的: 在实施"跳过手动修改"功能前备份原始函数
-- 包含3个函数的完整代码
-- ============================================================================

-- ============================================================================
-- 函数1: recalculate_costs_for_chain
-- ============================================================================
-- 来源: supabase/migrations/20250122_auto_recalc_on_project_partner_change.sql
-- 行数: 17-110
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain(
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
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        -- 获取运单的基础数据
        SELECT 
            current_cost + COALESCE(extra_cost, 0) as base,
            loading_weight,
            unloading_weight
        INTO v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 删除旧的合作方成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 根据最新的 project_partners 配置重新计算
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
            -- 计算应付金额
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
            
            -- 插入新的成本记录
            INSERT INTO logistics_partner_costs (
                logistics_record_id,
                partner_id,
                level,
                base_amount,
                payable_amount,
                tax_rate,
                user_id
            ) VALUES (
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                auth.uid()
            );
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$;

-- ============================================================================
-- 函数2: recalculate_costs_for_chain_safe
-- ============================================================================
-- 来源: supabase/migrations/20250122_auto_recalc_on_project_partner_change.sql
-- 行数: 235-353
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_costs_for_chain_safe(
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
    v_updated_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_total_count INTEGER := 0;
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_has_paid_status BOOLEAN;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id 
          AND chain_id = p_chain_id
    LOOP
        v_total_count := v_total_count + 1;
        
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
        
        -- 获取运单的基础数据
        SELECT 
            current_cost + COALESCE(extra_cost, 0) as base,
            loading_weight,
            unloading_weight
        INTO v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 删除旧的合作方成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 根据最新的 project_partners 配置重新计算
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
            -- 计算应付金额
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
            
            -- 插入新的成本记录
            INSERT INTO logistics_partner_costs (
                logistics_record_id,
                partner_id,
                level,
                base_amount,
                payable_amount,
                tax_rate,
                user_id
            ) VALUES (
                v_record_id,
                v_project_partners.partner_id,
                v_project_partners.level,
                v_base_amount,
                v_payable_amount,
                v_project_partners.tax_rate,
                auth.uid()
            );
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'total_records', v_total_count,
        'updated_records', v_updated_count,
        'skipped_records', v_skipped_count,
        'message', format('总计 %s 条运单，更新 %s 条，跳过 %s 条（已付款）', 
            v_total_count, v_updated_count, v_skipped_count)
    );
END;
$$;

-- ============================================================================
-- 函数3: modify_logistics_record_chain_with_recalc
-- ============================================================================
-- 来源: supabase/migrations/20251025_fix_modify_chain_with_recalculation.sql
-- 行数: 32-204
-- ============================================================================

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
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 第三步：根据新链路重新计算并插入合作方成本
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
        -- 根据计算方法计算应付金额
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
        
        -- 插入新的成本记录
        INSERT INTO public.logistics_partner_costs (
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
            v_base_amount,
            v_payable_amount,
            v_project_partners.tax_rate,
            auth.uid()
        );
        
        v_inserted_count := v_inserted_count + 1;
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

-- ============================================================================
-- 备份完成信息
-- ============================================================================

SELECT '✅ 3个成本重算函数已备份' as 备份状态;

-- ============================================================================
-- 恢复方法
-- ============================================================================
-- 如果需要恢复到原始版本，执行此文件即可
-- psql -h your-host -U postgres -d postgres -f 成本重算函数_原始备份.sql
-- ============================================================================

