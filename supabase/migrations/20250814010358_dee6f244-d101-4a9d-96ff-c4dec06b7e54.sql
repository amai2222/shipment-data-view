-- 修复 driver_projects 表的唯一约束问题
-- 这可能是导致 driver_id 列引用歧义的根本原因

-- 1. 首先添加唯一约束（如果不存在）
ALTER TABLE public.driver_projects 
ADD CONSTRAINT IF NOT EXISTS driver_projects_driver_project_unique 
UNIQUE (driver_id, project_id);

-- 2. 修复可能存在的重复数据
DELETE FROM public.driver_projects dp1 
WHERE dp1.id NOT IN (
    SELECT MIN(dp2.id) 
    FROM public.driver_projects dp2 
    WHERE dp2.driver_id = dp1.driver_id 
    AND dp2.project_id = dp1.project_id
);

-- 3. 更新相关函数以避免列引用歧义
CREATE OR REPLACE FUNCTION public.recalculate_and_update_costs_for_records(p_record_ids uuid[])
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
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
                (COALESCE(partner_record.profit_rate, 0) * records_and_chains.effective_weight)
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
            COALESCE(
                NULLIF(LEAST(COALESCE(lr.loading_weight, 999999), COALESCE(lr.unloading_weight, 999999)), 999999),
                COALESCE(lr.loading_weight, lr.unloading_weight, 0)
            ) as effective_weight
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc_default
            ON lr.project_id = pc_default.project_id AND pc_default.is_default = true
        WHERE lr.id = ANY(p_record_ids)
    ) AS records_and_chains
    JOIN public.project_partners partner_record
        ON records_and_chains.project_id = partner_record.project_id
        AND records_and_chains.final_chain_id = partner_record.chain_id;
END;
$function$;