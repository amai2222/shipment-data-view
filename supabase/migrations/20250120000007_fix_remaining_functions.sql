-- 修复剩余的函数，确保所有运单相关操作都使用新的有效数量计算逻辑

-- 1. 确保 recalculate_and_update_costs_for_record 函数使用新的有效数量计算逻辑
CREATE OR REPLACE FUNCTION public.recalculate_and_update_costs_for_record(p_record_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- 删除现有的成本记录
    DELETE FROM public.logistics_partner_costs 
    WHERE logistics_record_id = p_record_id;

    -- 重新计算并插入成本记录
    INSERT INTO public.logistics_partner_costs
        (logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, user_id)
    SELECT
        records_and_chains.record_id,
        partner_record.partner_id,
        partner_record.level,
        records_and_chains.base_payable_amount,
        CASE
            WHEN partner_record.calculation_method = 'profit' THEN
                records_and_chains.base_payable_amount +
                (COALESCE(partner_record.profit_rate, 0) * records_and_chains.effective_quantity)
            ELSE
                CASE
                    WHEN partner_record.tax_rate IS NOT NULL AND partner_record.tax_rate <> 1 THEN
                        records_and_chains.base_payable_amount / (1 - partner_record.tax_rate)
                    ELSE
                        records_and_chains.base_payable_amount
                END
        END AS payable_amount,
        partner_record.tax_rate,
        auth.uid()
    FROM (
        SELECT
            lr.id as record_id,
            lr.project_id,
            COALESCE(lr.chain_id, pc_default.id) as final_chain_id,
            (COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0)) as base_payable_amount,
            -- 使用项目配置的有效数量类型计算有效数量
            public.calculate_effective_quantity(
                lr.loading_weight, 
                lr.unloading_weight, 
                COALESCE(p.effective_quantity_type, 'min_value')
            ) as effective_quantity
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc_default
            ON lr.project_id = pc_default.project_id AND pc_default.is_default = true
        LEFT JOIN public.projects p
            ON lr.project_id = p.id
        WHERE lr.id = p_record_id
    ) AS records_and_chains
    JOIN public.project_partners partner_record
        ON records_and_chains.project_id = partner_record.project_id
        AND records_and_chains.final_chain_id = partner_record.chain_id;
END;
$function$;

-- 2. 更新 update_logistics_record_via_recalc 函数（timestamp 版本），确保使用新的计算逻辑
CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc(
    p_record_id uuid,
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_driver_id uuid,
    p_driver_name text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date timestamp,
    p_loading_weight numeric,
    p_unloading_weight numeric,
    p_current_cost numeric,
    p_license_plate text,
    p_driver_phone text,
    p_transport_type text,
    p_extra_cost numeric,
    p_remarks text,
    p_unloading_date timestamp
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    driver_payable numeric;
BEGIN
    -- 计算司机应付金额
    driver_payable := (COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0));

    -- 更新运单记录
    UPDATE public.logistics_records SET
        project_id = p_project_id,
        project_name = p_project_name,
        chain_id = p_chain_id,
        driver_id = p_driver_id,
        driver_name = p_driver_name,
        loading_location = p_loading_location,
        unloading_location = p_unloading_location,
        loading_date = p_loading_date,
        unloading_date = p_unloading_date,
        loading_weight = p_loading_weight,
        unloading_weight = p_unloading_weight,
        current_cost = p_current_cost,
        extra_cost = p_extra_cost,
        payable_cost = driver_payable,
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        transport_type = p_transport_type,
        remarks = p_remarks
    WHERE id = p_record_id;

    -- 重新计算合作方成本（使用更新后的函数）
    PERFORM public.recalculate_and_update_costs_for_record(p_record_id);
END;
$function$;

-- 3. 添加注释说明
COMMENT ON FUNCTION public.recalculate_and_update_costs_for_record IS '重新计算单个记录的合作方成本，使用项目配置的有效数量类型';
COMMENT ON FUNCTION public.update_logistics_record_via_recalc IS '更新运单记录并重新计算合作方成本，使用项目配置的有效数量类型';
