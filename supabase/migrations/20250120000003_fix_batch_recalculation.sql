-- 修复批量重算函数，使其支持新的有效数量类型字段
-- 这个脚本会更新所有相关的计算函数

-- 1. 更新批量计算合作方成本的函数，使用项目配置的有效数量类型
CREATE OR REPLACE FUNCTION public.bulk_calculate_partner_costs(p_record_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- 删除现有的合作方成本记录
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = ANY(p_record_ids);

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
        WHERE lr.id = ANY(p_record_ids)
    ) AS records_and_chains
    JOIN public.project_partners partner_record
        ON records_and_chains.project_id = partner_record.project_id
        AND records_and_chains.final_chain_id = partner_record.chain_id;
END;
$function$;

-- 2. 更新单个记录重算函数
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

-- 3. 更新批量重算函数
CREATE OR REPLACE FUNCTION public.batch_recalculate_partner_costs(
  p_record_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    record_id uuid;
BEGIN
    -- 使用批量计算函数而不是循环单个计算
    PERFORM public.bulk_calculate_partner_costs(p_record_ids);
END;
$function$;

-- 4. 添加注释说明
COMMENT ON FUNCTION public.bulk_calculate_partner_costs IS '批量计算合作方成本，使用项目配置的有效数量类型';
COMMENT ON FUNCTION public.recalculate_and_update_costs_for_record IS '重新计算单个记录的合作方成本，使用项目配置的有效数量类型';
COMMENT ON FUNCTION public.batch_recalculate_partner_costs IS '批量重算合作方成本，使用优化的批量计算函数';
