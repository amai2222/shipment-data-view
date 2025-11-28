

CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc_1128(
    p_record_id uuid,
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_billing_type_id bigint,  -- ✅ 计费模式ID参数
    p_driver_id uuid,
    p_driver_name text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date text,
    p_unloading_date text,
    p_loading_weight numeric,
    p_unloading_weight numeric,
    p_unit_price numeric,
    p_current_cost numeric,
    p_extra_cost numeric,
    p_license_plate text,
    p_driver_phone text,
    p_transport_type text,
    p_remarks text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_is_auto_mode BOOLEAN;
    v_effective_quantity NUMERIC;
    v_calculated_cost NUMERIC;
    v_billing_type_id bigint;  -- ✅ 计费模式ID变量
    driver_payable numeric;  -- ✅ 司机应付金额
    v_old_payable_cost numeric;  -- ✅ 新增：保存旧的 payable_cost
    v_new_payable_cost numeric;  -- ✅ 新增：保存新的 payable_cost
    v_recalc_result JSONB;  -- ✅ 新增：重算结果
BEGIN
    -- ✅ 获取 billing_type_id（优先使用参数，否则从链路中获取）
    IF p_billing_type_id IS NOT NULL AND p_billing_type_id > 0 THEN
        v_billing_type_id := p_billing_type_id;
    ELSE
        -- 从链路中获取 billing_type_id
        SELECT billing_type_id INTO v_billing_type_id 
        FROM public.partner_chains 
        WHERE id = p_chain_id;
        
        -- 如果链路中没有，默认为1（计吨）
        v_billing_type_id := COALESCE(v_billing_type_id, 1);
    END IF;

    -- 判断是否为自动计算模式
    v_is_auto_mode := (p_unit_price IS NOT NULL AND p_unit_price > 0);
    
    -- 计算有效数量（无论什么模式都需要计算）
    v_effective_quantity := public.get_effective_quantity_for_record_1120(
        p_loading_weight,
        p_unloading_weight,
        p_project_id,
        p_chain_id
    );
    
    -- 如果是自动模式，计算运费
    IF v_is_auto_mode AND v_effective_quantity IS NOT NULL AND v_effective_quantity > 0 THEN
        v_calculated_cost := ROUND(p_unit_price * v_effective_quantity, 2);
    ELSE
        -- 手动模式，使用传入的运费
        v_calculated_cost := COALESCE(p_current_cost, 0);
    END IF;
    
    -- ✅ 计算司机应付金额
    driver_payable := v_calculated_cost + COALESCE(p_extra_cost, 0);
    
    -- ✅ 获取旧的 payable_cost（用于判断是否需要重算）
    SELECT payable_cost INTO v_old_payable_cost
    FROM public.logistics_records
    WHERE id = p_record_id;
    
    v_new_payable_cost := driver_payable;
    
    -- 更新记录（显式设置所有计算字段，包括 billing_type_id）
    UPDATE public.logistics_records
    SET 
        project_id = p_project_id,
        project_name = p_project_name,
        chain_id = p_chain_id,
        billing_type_id = v_billing_type_id,  -- ✅ 保存计费模式ID
        driver_id = p_driver_id,
        driver_name = p_driver_name,
        loading_location = p_loading_location,
        unloading_location = p_unloading_location,
        loading_date = CASE 
            WHEN p_loading_date IS NOT NULL AND p_loading_date != '' 
            THEN (p_loading_date::text || ' 00:00:00+08:00')::timestamptz 
            ELSE NULL 
        END,
        unloading_date = CASE 
            WHEN p_unloading_date IS NOT NULL AND p_unloading_date != '' 
            THEN (p_unloading_date::text || ' 00:00:00+08:00')::timestamptz 
            ELSE NULL 
        END,
        loading_weight = p_loading_weight,
        unloading_weight = p_unloading_weight,
        unit_price = p_unit_price,
        calculation_mode = CASE 
            WHEN v_is_auto_mode THEN 'auto'
            ELSE 'manual'
        END,
        effective_quantity = v_effective_quantity,
        current_cost = v_calculated_cost,
        extra_cost = p_extra_cost,
        payable_cost = driver_payable,  -- ✅ 使用计算的司机应付金额
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        transport_type = p_transport_type,
        remarks = p_remarks,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- ✅ 修复：如果 payable_cost 发生变化，显式调用重算函数确保合作方成本被正确重算
    -- 这样即使触发器没有正常工作，也能确保合作方成本被正确重算
    IF v_old_payable_cost IS DISTINCT FROM v_new_payable_cost THEN
        -- 调用批量重算函数（只重算当前运单）
        SELECT public.batch_recalculate_partner_costs_1120(ARRAY[p_record_id]) INTO v_recalc_result;
        
        -- 记录日志（可选，用于调试）
        IF v_recalc_result IS NOT NULL AND (v_recalc_result->>'success')::boolean = false THEN
            RAISE WARNING '合作方成本重算失败: %', v_recalc_result->>'message';
        ELSE
            RAISE NOTICE '✅ 合作方成本已自动重算: 司机应收 % → %', 
                COALESCE(v_old_payable_cost, 0), v_new_payable_cost;
        END IF;
    END IF;
    
    -- ✅ 注意：触发器也会自动重新计算合作方成本（双重保障）
END;
$$;

COMMENT ON FUNCTION public.update_logistics_record_via_recalc_1128 IS '更新运单记录并重新计算合作方成本（支持 billing_type_id，_1128版本，已修复：显式调用重算函数确保合作方成本被正确重算）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ update_logistics_record_via_recalc_1128 已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  • 在更新 payable_cost 后，显式调用 batch_recalculate_partner_costs_1120';
    RAISE NOTICE '  • 确保修改单价或扣点后，合作方成本能够自动重算';
    RAISE NOTICE '  • 双重保障：触发器 + 显式调用';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END;
$$;

