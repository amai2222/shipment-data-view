-- 完整修复批量重算功能
-- 确保所有相关函数和字段都正确创建

-- 1. 确保 effective_quantity_type 枚举存在
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'effective_quantity_type') THEN
        CREATE TYPE public.effective_quantity_type AS ENUM (
            'min_value',    -- 1. 装货数量和卸货数量取较小值
            'loading',      -- 2. 取装货数量
            'unloading'     -- 3. 取卸货数量
        );
    END IF;
END $$;

-- 2. 确保 projects 表有 effective_quantity_type 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'effective_quantity_type'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN effective_quantity_type public.effective_quantity_type 
        DEFAULT 'min_value' NOT NULL;
        
        -- 为现有项目设置默认值
        UPDATE public.projects 
        SET effective_quantity_type = 'min_value' 
        WHERE effective_quantity_type IS NULL;
    END IF;
END $$;

-- 3. 创建或更新 calculate_effective_quantity 函数
CREATE OR REPLACE FUNCTION public.calculate_effective_quantity(
  p_loading_quantity numeric,
  p_unloading_quantity numeric,
  p_effective_quantity_type public.effective_quantity_type
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  CASE p_effective_quantity_type
    WHEN 'min_value' THEN
      -- 取装货数量和卸货数量的较小值
      RETURN COALESCE(
        NULLIF(LEAST(
          COALESCE(p_loading_quantity, 999999), 
          COALESCE(p_unloading_quantity, 999999)
        ), 999999),
        COALESCE(p_loading_quantity, p_unloading_quantity, 0)
      );
    WHEN 'loading' THEN
      -- 取装货数量
      RETURN COALESCE(p_loading_quantity, 0);
    WHEN 'unloading' THEN
      -- 取卸货数量
      RETURN COALESCE(p_unloading_quantity, 0);
    ELSE
      -- 默认取较小值
      RETURN COALESCE(
        NULLIF(LEAST(
          COALESCE(p_loading_quantity, 999999), 
          COALESCE(p_unloading_quantity, 999999)
        ), 999999),
        COALESCE(p_loading_quantity, p_unloading_quantity, 0)
      );
  END CASE;
END;
$function$;

-- 4. 创建或更新 bulk_calculate_partner_costs 函数
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

-- 5. 创建或更新 batch_recalculate_partner_costs 函数
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

-- 6. 创建或更新 batch_recalculate_by_filter 函数
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

    -- 步骤 2: 使用批量计算函数
    PERFORM public.bulk_calculate_partner_costs(filtered_record_ids);
END;
$function$;

-- 7. 添加注释说明
COMMENT ON FUNCTION public.calculate_effective_quantity IS '计算有效数量，支持三种计算方式：min_value=取较小值，loading=取装货数量，unloading=取卸货数量';
COMMENT ON FUNCTION public.bulk_calculate_partner_costs IS '批量计算合作方成本，使用项目配置的有效数量类型';
COMMENT ON FUNCTION public.batch_recalculate_partner_costs IS '批量重算合作方成本，使用优化的批量计算函数';
COMMENT ON FUNCTION public.batch_recalculate_by_filter IS '根据筛选条件批量重算合作方成本，使用项目配置的有效数量类型';
