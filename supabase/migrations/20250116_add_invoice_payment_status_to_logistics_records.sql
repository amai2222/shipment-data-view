-- 为 logistics_records 表添加开票和付款状态字段
-- 这个迁移文件添加了 invoice_status 和 payment_status 字段

-- 添加开票状态字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(20) DEFAULT 'Uninvoiced' CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));

-- 添加付款状态字段  
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'Uninvoiced' CHECK (payment_status IN ('Uninvoiced', 'Processing', 'Invoiced'));

-- 添加开票申请时间
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS invoice_applied_at TIMESTAMP WITH TIME ZONE;

-- 添加开票完成时间
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS invoice_completed_at TIMESTAMP WITH TIME ZONE;

-- 添加付款申请时间
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS payment_applied_at TIMESTAMP WITH TIME ZONE;

-- 添加付款完成时间
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;

-- 添加开票申请单ID
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS invoice_request_id UUID REFERENCES public.invoice_requests(id);

-- 添加开票单号
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);

-- 添加付款申请单ID
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES public.payment_requests(id);

-- 添加付款参考号
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status 
ON public.logistics_records(invoice_status);

CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_status 
ON public.logistics_records(payment_status);

CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_request_id 
ON public.logistics_records(invoice_request_id);

CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_request_id 
ON public.logistics_records(payment_request_id);

-- 更新现有记录的默认状态
UPDATE public.logistics_records 
SET 
  invoice_status = 'Uninvoiced',
  payment_status = 'Uninvoiced'
WHERE invoice_status IS NULL OR payment_status IS NULL;

-- 添加注释
COMMENT ON COLUMN public.logistics_records.invoice_status IS '开票状态: Uninvoiced(未开票), Processing(开票中), Invoiced(已开票)';
COMMENT ON COLUMN public.logistics_records.payment_status IS '付款状态: Uninvoiced(未付款), Processing(付款中), Invoiced(已付款)';
COMMENT ON COLUMN public.logistics_records.invoice_applied_at IS '开票申请时间';
COMMENT ON COLUMN public.logistics_records.invoice_completed_at IS '开票完成时间';
COMMENT ON COLUMN public.logistics_records.payment_applied_at IS '付款申请时间';
COMMENT ON COLUMN public.logistics_records.payment_completed_at IS '付款完成时间';
COMMENT ON COLUMN public.logistics_records.invoice_request_id IS '关联的开票申请单ID';
COMMENT ON COLUMN public.logistics_records.invoice_number IS '开票单号';
COMMENT ON COLUMN public.logistics_records.payment_request_id IS '关联的付款申请单ID';
COMMENT ON COLUMN public.logistics_records.payment_reference IS '付款参考号';
