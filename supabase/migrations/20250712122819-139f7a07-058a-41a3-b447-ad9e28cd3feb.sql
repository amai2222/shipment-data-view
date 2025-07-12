-- 修复合作方成本计算函数，使用项目特定的税率而不是合作方默认税率
CREATE OR REPLACE FUNCTION public.calculate_partner_costs(p_base_amount numeric, p_project_id uuid)
 RETURNS TABLE(partner_id uuid, partner_name text, level integer, base_amount numeric, payable_amount numeric, tax_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  partner_record RECORD;
BEGIN
  -- 按级别顺序获取项目的合作方，使用项目特定的税率
  FOR partner_record IN 
    SELECT 
      pp.partner_id,
      p.name as partner_name,
      pp.level,
      pp.tax_rate  -- 使用项目特定的税率，而不是合作方默认税率
    FROM public.project_partners pp
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE pp.project_id = p_project_id
    ORDER BY pp.level ASC
  LOOP
    -- 每个合作方的应付款都基于原始运费金额计算：运费金额 / (1 - 税点)
    partner_id := partner_record.partner_id;
    partner_name := partner_record.partner_name;
    level := partner_record.level;
    base_amount := p_base_amount;  -- 基础金额始终是原始运费金额
    tax_rate := partner_record.tax_rate;  -- 使用项目特定税率
    payable_amount := p_base_amount / (1 - partner_record.tax_rate);  -- 基于项目特定税率计算
    
    RETURN NEXT;
  END LOOP;
END;
$function$;