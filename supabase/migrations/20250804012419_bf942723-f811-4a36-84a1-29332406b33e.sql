-- 创建付款记录表
CREATE TABLE public.payment_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logistics_record_id UUID NOT NULL,
  partner_id UUID NOT NULL,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  
  CONSTRAINT payment_records_logistics_record_id_fkey 
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE,
  CONSTRAINT payment_records_partner_id_fkey 
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 创建开票记录表
CREATE TABLE public.invoice_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logistics_record_id UUID NOT NULL,
  partner_id UUID NOT NULL,
  invoice_amount NUMERIC NOT NULL DEFAULT 0,
  invoice_number TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  
  CONSTRAINT invoice_records_logistics_record_id_fkey 
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE,
  CONSTRAINT invoice_records_partner_id_fkey 
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 启用RLS
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_records ENABLE ROW LEVEL SECURITY;

-- 付款记录RLS策略
CREATE POLICY "Users can view own payment_records" 
ON public.payment_records 
FOR SELECT 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can create own payment_records" 
ON public.payment_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment_records" 
ON public.payment_records 
FOR UPDATE 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can delete own payment_records" 
ON public.payment_records 
FOR DELETE 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

-- 开票记录RLS策略
CREATE POLICY "Users can view own invoice_records" 
ON public.invoice_records 
FOR SELECT 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can create own invoice_records" 
ON public.invoice_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoice_records" 
ON public.invoice_records 
FOR UPDATE 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can delete own invoice_records" 
ON public.invoice_records 
FOR DELETE 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

-- 创建索引以提高查询性能
CREATE INDEX idx_payment_records_logistics_record_id ON public.payment_records(logistics_record_id);
CREATE INDEX idx_payment_records_partner_id ON public.payment_records(partner_id);
CREATE INDEX idx_payment_records_payment_date ON public.payment_records(payment_date);

CREATE INDEX idx_invoice_records_logistics_record_id ON public.invoice_records(logistics_record_id);
CREATE INDEX idx_invoice_records_partner_id ON public.invoice_records(partner_id);
CREATE INDEX idx_invoice_records_invoice_date ON public.invoice_records(invoice_date);

-- 创建自动更新updated_at的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为付款记录表添加更新触发器
CREATE TRIGGER update_payment_records_updated_at
BEFORE UPDATE ON public.payment_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 为开票记录表添加更新触发器
CREATE TRIGGER update_invoice_records_updated_at
BEFORE UPDATE ON public.invoice_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();