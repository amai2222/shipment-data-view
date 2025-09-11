-- 更新有效数量计算逻辑，支持项目配置的有效数量类型

-- 1. 创建计算有效数量的函数
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

-- 2. 更新合作方成本计算函数，使用项目配置的有效数量类型
CREATE OR REPLACE FUNCTION public.calculate_partner_costs_v3(
  p_base_amount numeric, 
  p_project_id uuid,
  p_loading_quantity numeric DEFAULT NULL,
  p_unloading_quantity numeric DEFAULT NULL
)
RETURNS TABLE(
  partner_id uuid, 
  partner_name text, 
  level integer, 
  base_amount numeric, 
  payable_amount numeric, 
  tax_rate numeric,
  calculation_method text,
  profit_rate numeric,
  effective_quantity numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  partner_record RECORD;
  effective_quantity numeric;
  project_effective_quantity_type public.effective_quantity_type;
BEGIN
  -- 获取项目的有效数量类型
  SELECT p.effective_quantity_type 
  INTO project_effective_quantity_type
  FROM public.projects p
  WHERE p.id = p_project_id;
  
  -- 如果项目不存在，使用默认类型
  IF project_effective_quantity_type IS NULL THEN
    project_effective_quantity_type := 'min_value';
  END IF;

  -- 计算有效数量
  effective_quantity := public.calculate_effective_quantity(
    p_loading_quantity, 
    p_unloading_quantity, 
    project_effective_quantity_type
  );

  -- 按级别顺序获取项目的合作方，包含计算方法信息
  FOR partner_record IN 
    SELECT 
      pp.partner_id,
      p.name as partner_name,
      pp.level,
      pp.tax_rate,
      pp.calculation_method,
      COALESCE(pp.profit_rate, 0) as profit_rate
    FROM public.project_partners pp
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE pp.project_id = p_project_id
    ORDER BY pp.level ASC
  LOOP
    partner_id := partner_record.partner_id;
    partner_name := partner_record.partner_name;
    level := partner_record.level;
    base_amount := p_base_amount;
    tax_rate := partner_record.tax_rate;
    calculation_method := partner_record.calculation_method;
    profit_rate := partner_record.profit_rate;
    
    -- 根据计算方法计算应付金额
    IF partner_record.calculation_method = 'profit' THEN
      -- 利润计算方法：基础金额 + (利润率 * 有效数量)
      IF effective_quantity > 0 THEN
        payable_amount := p_base_amount + (partner_record.profit_rate * effective_quantity);
      ELSE
        payable_amount := p_base_amount + partner_record.profit_rate;
      END IF;
    ELSE
      -- 税点计算方法：基础金额 / (1 - 税点)
      IF partner_record.tax_rate IS NOT NULL AND partner_record.tax_rate <> 1 THEN
        payable_amount := p_base_amount / (1 - partner_record.tax_rate);
      ELSE
        payable_amount := p_base_amount;
      END IF;
    END IF;
    
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 3. 更新批量计算合作方成本的函数
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

-- 4. 添加注释说明
COMMENT ON FUNCTION public.calculate_effective_quantity IS '根据项目配置的有效数量类型计算有效数量';
COMMENT ON FUNCTION public.calculate_partner_costs_v3 IS '计算合作方成本，支持项目配置的有效数量类型';
COMMENT ON FUNCTION public.bulk_calculate_partner_costs IS '批量计算合作方成本，使用项目配置的有效数量类型';
