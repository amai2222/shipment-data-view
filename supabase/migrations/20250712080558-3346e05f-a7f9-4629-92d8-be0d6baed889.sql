-- 创建合作方表
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL CHECK (tax_rate >= 0 AND tax_rate < 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name)
);

-- 创建项目合作方关联表
CREATE TABLE public.project_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, partner_id),
  UNIQUE(project_id, level)
);

-- 创建物流记录合作方费用表
CREATE TABLE public.logistics_partner_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logistics_record_id UUID NOT NULL REFERENCES public.logistics_records(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  base_amount DECIMAL(12,2) NOT NULL,
  payable_amount DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_partner_costs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Allow all operations on partners" ON public.partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on project_partners" ON public.project_partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on logistics_partner_costs" ON public.logistics_partner_costs FOR ALL USING (true) WITH CHECK (true);

-- 创建计算多级合作方费用的函数
CREATE OR REPLACE FUNCTION public.calculate_partner_costs(
  p_base_amount DECIMAL,
  p_project_id UUID
) RETURNS TABLE (
  partner_id UUID,
  partner_name TEXT,
  level INTEGER,
  base_amount DECIMAL,
  payable_amount DECIMAL,
  tax_rate DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_amount DECIMAL := p_base_amount;
  partner_record RECORD;
BEGIN
  -- 按级别顺序获取项目的合作方
  FOR partner_record IN 
    SELECT 
      pp.partner_id,
      p.name as partner_name,
      pp.level,
      p.tax_rate
    FROM public.project_partners pp
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE pp.project_id = p_project_id
    ORDER BY pp.level ASC
  LOOP
    -- 计算当前合作方的应付款
    partner_id := partner_record.partner_id;
    partner_name := partner_record.partner_name;
    level := partner_record.level;
    base_amount := current_amount;
    tax_rate := partner_record.tax_rate;
    payable_amount := current_amount / (1 - partner_record.tax_rate);
    
    -- 下一级的基础金额是当前级的应付款
    current_amount := payable_amount;
    
    RETURN NEXT;
  END LOOP;
END;
$$;