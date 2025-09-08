-- 创建合同分类枚举
CREATE TYPE contract_category AS ENUM ('行政合同', '内部合同', '业务合同');

-- 创建合同管理表
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category contract_category NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  counterparty_company TEXT NOT NULL,
  our_company TEXT NOT NULL,
  contract_amount NUMERIC,
  contract_original_url TEXT,
  attachment_url TEXT,
  remarks TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Authenticated users can manage contracts" 
ON public.contracts 
FOR ALL 
USING (is_authenticated_user()) 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Admins can manage all contracts" 
ON public.contracts 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Finance can view all contracts" 
ON public.contracts 
FOR ALL 
USING (is_finance_or_admin(auth.uid())) 
WITH CHECK (is_finance_or_admin(auth.uid()));

-- 创建更新时间触发器
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();