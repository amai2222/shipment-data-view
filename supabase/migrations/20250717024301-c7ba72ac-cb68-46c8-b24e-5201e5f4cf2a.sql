-- 创建新的费用计算函数，支持利润计算方法
CREATE OR REPLACE FUNCTION public.calculate_partner_costs_v2(
  p_base_amount numeric, 
  p_project_id uuid,
  p_loading_weight numeric DEFAULT NULL,
  p_unloading_weight numeric DEFAULT NULL
)
RETURNS TABLE(
  partner_id uuid, 
  partner_name text, 
  level integer, 
  base_amount numeric, 
  payable_amount numeric, 
  tax_rate numeric,
  calculation_method text,
  profit_rate numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  partner_record RECORD;
  effective_weight numeric;
BEGIN
  -- 计算有效重量：取不为空且不为0的最小值
  effective_weight := COALESCE(
    NULLIF(LEAST(
      COALESCE(p_loading_weight, 999999), 
      COALESCE(p_unloading_weight, 999999)
    ), 999999),
    COALESCE(p_loading_weight, p_unloading_weight, 0)
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
      -- 利润计算方法：重量 * (司机运费/重量 + 设置的利润)
      IF effective_weight > 0 THEN
        payable_amount := effective_weight * ((p_base_amount / effective_weight) + partner_record.profit_rate);
      ELSE
        payable_amount := p_base_amount + partner_record.profit_rate;
      END IF;
    ELSE
      -- 税点计算方法：运费金额 / (1 - 税点)
      payable_amount := p_base_amount / (1 - partner_record.tax_rate);
    END IF;
    
    RETURN NEXT;
  END LOOP;
END;
$function$;