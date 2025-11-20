-- ============================================================================
-- 更新剩余重算函数：_1120 版本 + 定价法支持
-- 日期：2025-11-20
-- 说明：
--   1. 更新 modify_logistics_record_chain_with_recalc -> _1120
--   2. 更新 batch_recalculate_by_filter_1116 -> _1120
--   3. 添加定价法（fixed_price）支持
--   4. 添加三重保护机制
-- ============================================================================

-- ============================================================================
-- 第一个函数：modify_logistics_record_chain_with_recalc_1120
-- 功能：修改运单链路并重算成本
-- ============================================================================

CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain_with_recalc_1120(
    p_record_id UUID,
    p_chain_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_can_access BOOLEAN;
    v_project_id UUID;
    v_chain_id UUID;
    v_old_chain_name TEXT;
    v_payment_status TEXT;
    v_invoice_status TEXT;
    v_receipt_status TEXT;  -- 新增：收款状态
    v_project_partners RECORD;
    v_base_amount NUMERIC;
    v_payable_amount NUMERIC;
    v_loading_weight NUMERIC;
    v_unloading_weight NUMERIC;
    v_effective_quantity NUMERIC;  -- 新增：有效数量
    v_inserted_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_manually_modified_costs JSONB;
    v_manual_value NUMERIC;
    v_is_manual BOOLEAN;
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
        lr.payable_cost,  -- 使用 payable_cost（司机应收）
        lr.loading_weight,
        lr.unloading_weight,
        lr.effective_quantity,
        lr.payment_status,
        lr.invoice_status,
        lr.receipt_status  -- 新增：获取收款状态
    INTO 
        v_project_id, 
        v_old_chain_name, 
        v_base_amount,
        v_loading_weight,
        v_unloading_weight,
        v_effective_quantity,
        v_payment_status,
        v_invoice_status,
        v_receipt_status
    FROM public.logistics_records lr
    LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
    WHERE lr.id = p_record_id;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '运单记录不存在'
        );
    END IF;
    
    -- ✅ 保护逻辑：只允许【未付款 且 未开票 且 未收款】的运单修改链路
    
    -- 检查付款状态
    IF v_payment_status != 'Unpaid' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未付款的运单才能修改合作链路（必须：未付款 且 未开票 且 未收款）'
        );
    END IF;
    
    -- 检查开票状态
    IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未开票的运单才能修改合作链路（必须：未付款 且 未开票 且 未收款）'
        );
    END IF;
    
    -- 检查收款状态
    IF v_receipt_status IS NOT NULL AND v_receipt_status = 'Received' THEN
        RETURN json_build_object(
            'success', false,
            'message', '只有未收款的运单才能修改合作链路（必须：未付款 且 未开票 且 未收款）'
        );
    END IF;
    
    -- 通过所有检查，允许修改链路（状态：未付款 AND 未开票 AND 未收款）
    
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
    
    -- 如果有效数量为空或为0，重新计算
    IF v_effective_quantity IS NULL OR v_effective_quantity = 0 THEN
        v_effective_quantity := public.get_effective_quantity_for_record_1120(
            v_loading_weight,
            v_unloading_weight,
            v_project_id,
            v_chain_id
        );
    END IF;
    
    -- 保存所有手动修改的成本（按partner_id + level匹配）
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
            pp.profit_rate,
            pp.unit_price  -- 新增：单价
        FROM public.project_partners pp
        WHERE pp.project_id = v_project_id
        AND pp.chain_id = v_chain_id
        ORDER BY pp.level ASC
    LOOP
        -- 检查该合作方是否被手动修改过
        v_manual_value := NULL;
        v_is_manual := FALSE;
        
        IF v_manually_modified_costs IS NOT NULL THEN
            SELECT (elem->>'payable_amount')::NUMERIC
            INTO v_manual_value
            FROM jsonb_array_elements(v_manually_modified_costs) AS elem
            WHERE (elem->>'partner_id')::UUID = v_project_partners.partner_id
            AND (elem->>'level')::INTEGER = v_project_partners.level;
            
            IF v_manual_value IS NOT NULL THEN
                v_is_manual := TRUE;
                v_payable_amount := v_manual_value;
                v_protected_count := v_protected_count + 1;
                RAISE NOTICE '✅ 恢复手动修改：level=%, amount=%', v_project_partners.level, v_payable_amount;
            END IF;
        END IF;
        
        -- 如果不是手动修改，按系统规则计算
        IF NOT v_is_manual THEN
            IF v_project_partners.calculation_method = 'fixed_price' THEN
                -- 定价法：有效数量 × 单价
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
        END IF;
        
        -- 插入新的成本记录
        INSERT INTO public.logistics_partner_costs (
            logistics_record_id,
            partner_id,
            level,
            base_amount,
            payable_amount,
            tax_rate,
            is_manually_modified
        ) VALUES (
            p_record_id,
            v_project_partners.partner_id,
            v_project_partners.level,
            v_base_amount,
            v_payable_amount,
            v_project_partners.tax_rate,
            v_is_manual
        );
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', format('链路已从 "%s" 修改为 "%s"，重新计算了 %s 个合作方成本（保护了 %s 个手动修改）', 
            v_old_chain_name, p_chain_name, v_inserted_count, v_protected_count),
        'old_chain', v_old_chain_name,
        'new_chain', p_chain_name,
        'inserted_count', v_inserted_count,
        'protected_count', v_protected_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '修改链路失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.modify_logistics_record_chain_with_recalc_1120 IS '修改运单链路并重算成本（_1120版本，支持定价法+三重保护）';

-- ============================================================================
-- 第二个函数：batch_recalculate_by_filter_1120
-- 功能：根据筛选条件批量重算合作方成本
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_recalculate_by_filter_1120(
    p_project_id TEXT DEFAULT NULL,  -- 支持逗号分隔的多个 UUID
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record_ids UUID[];
    v_project_ids UUID[];
    v_result JSON;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_operator_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以重算成本'
        );
    END IF;
    
    -- 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::UUID[];
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 根据筛选条件获取符合条件的运单ID列表
    SELECT array_agg(DISTINCT lr.id)
    INTO v_record_ids
    FROM public.logistics_records lr
    WHERE 
        (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
        AND (p_start_date IS NULL OR lr.loading_date::date >= p_start_date)
        AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date)
        AND (p_partner_id IS NULL OR EXISTS (
            SELECT 1 FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = lr.id 
            AND lpc.partner_id = p_partner_id
        ));
    
    -- 如果没有符合条件的运单，返回空结果
    IF v_record_ids IS NULL OR array_length(v_record_ids, 1) IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'message', '没有符合条件的运单需要重算',
            'total_count', 0,
            'updated_count', 0,
            'skipped_count', 0,
            'protected_count', 0
        );
    END IF;
    
    -- 调用批量重算函数（使用 _1120 版本）
    SELECT public.batch_recalculate_partner_costs_1120(v_record_ids) INTO v_result;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.batch_recalculate_by_filter_1120 IS '根据筛选条件批量重算合作方成本（_1120版本，支持多个 project_id + 定价法 + 三重保护）';

-- ============================================================================
-- 验证信息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 剩余重算函数已更新为 _1120 版本';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '更新的函数：';
    RAISE NOTICE '  1. modify_logistics_record_chain_with_recalc_1120';
    RAISE NOTICE '  2. batch_recalculate_by_filter_1120';
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
    RAISE NOTICE '========================================';
END $$;

