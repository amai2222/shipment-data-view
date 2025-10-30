-- ============================================================================
-- 实施手动修改保护功能 - 完整SQL脚本
-- ============================================================================
-- 功能：成本重算时跳过用户手动修改的最高级合作方应收
-- 日期：2025-10-26
-- 备份：成本重算函数_原始备份.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 步骤1：添加手动修改标记字段
-- ============================================================================

ALTER TABLE public.logistics_partner_costs 
ADD COLUMN IF NOT EXISTS is_manually_modified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.logistics_partner_costs.is_manually_modified IS 
'标记该成本是否被用户手动修改。TRUE=用户手动修改，重算时保留；FALSE=系统计算，可以重算';

-- 创建索引（提高查询性能）
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_manual_modified 
ON public.logistics_partner_costs(logistics_record_id, level, is_manually_modified) 
WHERE is_manually_modified = TRUE;

SELECT '✅ 步骤1完成：已添加 is_manually_modified 字段' as 状态;

-- ============================================================================
-- 步骤2：修改 modify_logistics_record_chain_with_recalc 函数
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
    -- 🆕 保存手动修改的成本
    v_manual_partner_id UUID;
    v_manual_level INTEGER;
    v_manual_amount NUMERIC;
    v_has_manual_modified BOOLEAN := FALSE;
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
        RETURN json_build_object('success', false, 'message', '运单记录不存在');
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
    WHERE project_id = v_project_id AND chain_name = p_chain_name
    LIMIT 1;
    
    IF v_chain_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', '指定的合作链路不存在');
    END IF;
    
    -- 🆕 第一步：检查并保存手动修改的最高级合作方成本
    SELECT 
        partner_id,
        level,
        payable_amount
    INTO v_manual_partner_id, v_manual_level, v_manual_amount
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id
      AND is_manually_modified = TRUE
    ORDER BY level DESC
    LIMIT 1;
    
    IF v_manual_partner_id IS NOT NULL THEN
        v_has_manual_modified := TRUE;
        RAISE NOTICE '✅ 检测到手动修改的成本：合作方=%, 级别=%, 金额=%', 
                     v_manual_partner_id, v_manual_level, v_manual_amount;
    END IF;
    
    -- 第二步：删除该运单的旧成本记录
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_record_id;
    
    -- 第三步：更新运单的链路信息
    UPDATE public.logistics_records
    SET chain_id = v_chain_id, updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 第四步：根据新链路重新计算并插入合作方成本
    FOR v_project_partners IN
        SELECT pp.partner_id, pp.level, pp.calculation_method, pp.tax_rate, pp.profit_rate
        FROM public.project_partners pp
        WHERE pp.project_id = v_project_id AND pp.chain_id = v_chain_id
        ORDER BY pp.level ASC
    LOOP
        -- 🔍 检查是否是手动修改的最高级合作方
        IF v_has_manual_modified 
           AND v_project_partners.partner_id = v_manual_partner_id 
           AND v_project_partners.level = v_manual_level THEN
            -- ✅ 保留用户手动修改的值
            v_payable_amount := v_manual_amount;
            
            INSERT INTO public.logistics_partner_costs (
                logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, is_manually_modified, user_id
            ) VALUES (
                p_record_id, v_project_partners.partner_id, v_project_partners.level,
                v_base_amount, v_payable_amount, v_project_partners.tax_rate,
                TRUE,  -- 🆕 保留手动修改标记
                auth.uid()
            );
            
            RAISE NOTICE '✅ 保留手动修改的最高级合作方成本：%', v_payable_amount;
        ELSE
            -- ❌ 系统自动计算其他层级
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
            
            INSERT INTO public.logistics_partner_costs (
                logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, is_manually_modified, user_id
            ) VALUES (
                p_record_id, v_project_partners.partner_id, v_project_partners.level,
                v_base_amount, v_payable_amount, v_project_partners.tax_rate,
                FALSE,  -- 系统计算
                auth.uid()
            );
        END IF;
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    -- 返回成功结果（包含保护信息）
    RETURN json_build_object(
        'success', true,
        'message', CASE 
            WHEN v_has_manual_modified THEN '合作链路修改成功，已保护您手动修改的最高级合作方成本'
            ELSE '合作链路修改成功，已重新计算成本'
        END,
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name,
        'recalculated_partners', v_inserted_count,
        'manual_modified_protected', v_has_manual_modified
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ 步骤2完成：已修改 modify_logistics_record_chain_with_recalc 函数' as 状态;

-- ============================================================================
-- 步骤3：修改 recalculate_costs_for_chain 函数
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
    -- 🆕 保存手动修改的成本
    v_manual_partner_id UUID;
    v_manual_level INTEGER;
    v_manual_amount NUMERIC;
    v_has_manual_modified BOOLEAN;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id AND chain_id = p_chain_id
    LOOP
        -- 获取运单的基础数据
        SELECT 
            current_cost + COALESCE(extra_cost, 0) as base,
            loading_weight,
            unloading_weight
        INTO v_base_amount, v_loading_weight, v_unloading_weight
        FROM logistics_records
        WHERE id = v_record_id;
        
        -- 🆕 检查并保存手动修改的最高级合作方成本
        SELECT partner_id, level, payable_amount
        INTO v_manual_partner_id, v_manual_level, v_manual_amount
        FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id AND is_manually_modified = TRUE
        ORDER BY level DESC
        LIMIT 1;
        
        v_has_manual_modified := (v_manual_partner_id IS NOT NULL);
        
        -- 删除旧的合作方成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 根据最新的 project_partners 配置重新计算
        FOR v_project_partners IN
            SELECT partner_id, level, tax_rate, calculation_method, profit_rate
            FROM project_partners
            WHERE project_id = p_project_id AND chain_id = p_chain_id
            ORDER BY level ASC
        LOOP
            -- 🔍 检查是否是手动修改的最高级合作方
            IF v_has_manual_modified 
               AND v_project_partners.partner_id = v_manual_partner_id 
               AND v_project_partners.level = v_manual_level THEN
                -- ✅ 保留手动修改的值
                v_payable_amount := v_manual_amount;
                
                INSERT INTO logistics_partner_costs (
                    logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, is_manually_modified, user_id
                ) VALUES (
                    v_record_id, v_project_partners.partner_id, v_project_partners.level,
                    v_base_amount, v_payable_amount, v_project_partners.tax_rate,
                    TRUE, auth.uid()
                );
            ELSE
                -- ❌ 系统自动计算
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
                
                INSERT INTO logistics_partner_costs (
                    logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, is_manually_modified, user_id
                ) VALUES (
                    v_record_id, v_project_partners.partner_id, v_project_partners.level,
                    v_base_amount, v_payable_amount, v_project_partners.tax_rate,
                    FALSE, auth.uid()
                );
            END IF;
        END LOOP;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$;

SELECT '✅ 步骤3完成：已修改 recalculate_costs_for_chain 函数' as 状态;

-- ============================================================================
-- 步骤4：修改 recalculate_costs_for_chain_safe 函数
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
    -- 🆕 保存手动修改的成本
    v_manual_partner_id UUID;
    v_manual_level INTEGER;
    v_manual_amount NUMERIC;
    v_has_manual_modified BOOLEAN;
BEGIN
    -- 遍历所有使用该链路的运单
    FOR v_record_id IN 
        SELECT id 
        FROM logistics_records 
        WHERE project_id = p_project_id AND chain_id = p_chain_id
    LOOP
        v_total_count := v_total_count + 1;
        
        -- 检查是否有已付款的成本记录
        SELECT EXISTS (
            SELECT 1 FROM logistics_partner_costs
            WHERE logistics_record_id = v_record_id AND payment_status = 'Paid'
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
        
        -- 🆕 检查并保存手动修改的最高级合作方成本
        SELECT partner_id, level, payable_amount
        INTO v_manual_partner_id, v_manual_level, v_manual_amount
        FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id AND is_manually_modified = TRUE
        ORDER BY level DESC
        LIMIT 1;
        
        v_has_manual_modified := (v_manual_partner_id IS NOT NULL);
        
        -- 删除旧的合作方成本记录
        DELETE FROM logistics_partner_costs
        WHERE logistics_record_id = v_record_id;
        
        -- 根据最新的 project_partners 配置重新计算
        FOR v_project_partners IN
            SELECT partner_id, level, tax_rate, calculation_method, profit_rate
            FROM project_partners
            WHERE project_id = p_project_id AND chain_id = p_chain_id
            ORDER BY level ASC
        LOOP
            -- 🔍 检查是否是手动修改的最高级合作方
            IF v_has_manual_modified 
               AND v_project_partners.partner_id = v_manual_partner_id 
               AND v_project_partners.level = v_manual_level THEN
                -- ✅ 保留手动修改的值
                v_payable_amount := v_manual_amount;
                
                INSERT INTO logistics_partner_costs (
                    logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, is_manually_modified, user_id
                ) VALUES (
                    v_record_id, v_project_partners.partner_id, v_project_partners.level,
                    v_base_amount, v_payable_amount, v_project_partners.tax_rate,
                    TRUE, auth.uid()
                );
            ELSE
                -- ❌ 系统自动计算
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
                
                INSERT INTO logistics_partner_costs (
                    logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, is_manually_modified, user_id
                ) VALUES (
                    v_record_id, v_project_partners.partner_id, v_project_partners.level,
                    v_base_amount, v_payable_amount, v_project_partners.tax_rate,
                    FALSE, auth.uid()
                );
            END IF;
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

SELECT '✅ 步骤4完成：已修改 recalculate_costs_for_chain_safe 函数' as 状态;

COMMIT;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 手动修改保护功能实施完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增字段：';
    RAISE NOTICE '  - logistics_partner_costs.is_manually_modified';
    RAISE NOTICE '';
    RAISE NOTICE '修改的函数：';
    RAISE NOTICE '  ✓ modify_logistics_record_chain_with_recalc';
    RAISE NOTICE '  ✓ recalculate_costs_for_chain';
    RAISE NOTICE '  ✓ recalculate_costs_for_chain_safe';
    RAISE NOTICE '';
    RAISE NOTICE '功能说明：';
    RAISE NOTICE '  - 用户手动修改最高级合作方应收后';
    RAISE NOTICE '  - 系统会标记 is_manually_modified = TRUE';
    RAISE NOTICE '  - 后续成本重算时会跳过该记录';
    RAISE NOTICE '  - 保留用户的手动修改值';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '  1. 修改前端 PaymentRequest.tsx';
    RAISE NOTICE '  2. 在保存应收时添加 is_manually_modified: true';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

