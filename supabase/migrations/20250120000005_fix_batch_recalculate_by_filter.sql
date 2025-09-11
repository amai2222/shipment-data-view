-- 修复 batch_recalculate_by_filter 函数，使其支持新的有效数量类型字段

CREATE OR REPLACE FUNCTION public.batch_recalculate_by_filter(
    p_project_id uuid DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    filtered_record_ids uuid[];
BEGIN
    -- 步骤 1: 根据传入的筛选条件，获取所有需要重算的运单ID
    SELECT ARRAY_AGG(v.id)
    INTO filtered_record_ids
    FROM public.logistics_records_view AS v
    WHERE
        (p_project_id IS NULL OR v.project_id = p_project_id) AND
        (p_start_date IS NULL OR v.loading_date::date >= p_start_date::date) AND
        (p_end_date IS NULL OR v.loading_date::date <= p_end_date::date) AND
        (p_partner_id IS NULL OR EXISTS (
            SELECT 1 FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
        ));

    -- 如果没有找到记录，则提前退出
    IF COALESCE(array_length(filtered_record_ids, 1), 0) = 0 THEN
        RETURN;
    END IF;

    -- 步骤 2: 执行集合式操作，使用新的有效数量计算逻辑

    -- 2.1: 一次性删除所有相关运单的现有合作方成本
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = ANY(filtered_record_ids);

    -- 2.2: 使用新的有效数量计算逻辑，一次性为所有相关运单计算并插入新的成本
    WITH records_to_process AS (
        -- 这个 CTE 预处理所有需要计算的运单，并准备好所有基础数据
        SELECT
            lr.id,
            lr.project_id,
            -- 确定有效链路ID: 优先用运单自带的，否则用项目的默认链路
            COALESCE(lr.chain_id, dc.id) AS effective_chain_id,
            -- 计算基础应付金额
            (COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0)) AS base_payable_amount,
            -- 【核心修复】使用项目配置的有效数量类型计算有效数量
            public.calculate_effective_quantity(
                lr.loading_weight, 
                lr.unloading_weight, 
                COALESCE(p.effective_quantity_type, 'min_value')
            ) AS effective_quantity
        FROM
            public.logistics_records lr
        -- 左连接到默认链路表，以便在运单没有指定链路时使用
        LEFT JOIN
            public.partner_chains dc ON lr.project_id = dc.project_id AND dc.is_default = true
        -- 【新增】左连接到项目表，获取有效数量类型配置
        LEFT JOIN
            public.projects p ON lr.project_id = p.id
        WHERE
            lr.id = ANY(filtered_record_ids)
    )
    -- 将计算结果一次性插入成本表
    INSERT INTO public.logistics_partner_costs
        (logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, user_id)
    SELECT
        rec.id AS logistics_record_id,
        pp.partner_id,
        pp.level,
        rec.base_payable_amount AS base_amount,
        -- 这是最核心的成本计算逻辑，使用新的有效数量计算
        CASE
            WHEN pp.calculation_method = 'profit' THEN
                CASE
                    WHEN rec.effective_quantity > 0 THEN
                        rec.base_payable_amount + (COALESCE(pp.profit_rate, 0) * rec.effective_quantity)
                    ELSE
                        rec.base_payable_amount + COALESCE(pp.profit_rate, 0)
                END
            ELSE -- 默认为税点法
                CASE
                    WHEN pp.tax_rate IS NOT NULL AND pp.tax_rate <> 1 THEN
                        rec.base_payable_amount / (1 - pp.tax_rate)
                    ELSE
                        rec.base_payable_amount
                END
        END AS payable_amount,
        pp.tax_rate,
        auth.uid()
    FROM
        records_to_process rec
    -- 将处理好的运单记录，与其有效链路上的所有合作方进行连接
    JOIN
        public.project_partners pp ON rec.effective_chain_id = pp.chain_id
    -- 确保只处理有有效链路的记录
    WHERE
        rec.effective_chain_id IS NOT NULL AND rec.base_payable_amount > 0;

END;
$function$;

-- 添加注释说明
COMMENT ON FUNCTION public.batch_recalculate_by_filter IS '根据筛选条件批量重算合作方成本，使用项目配置的有效数量类型';
