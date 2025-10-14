-- 修复开票申请单表的外键关系

-- 1. 确保invoice_requests表有created_by字段
ALTER TABLE IF EXISTS public.invoice_requests 
ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2. 添加外键约束（如果不存在）
DO $$
BEGIN
    -- 检查并添加created_by外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_requests_created_by' 
        AND table_name = 'invoice_requests'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_requests 
        ADD CONSTRAINT fk_invoice_requests_created_by 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id);
    END IF;

    -- 检查并添加voided_by外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_requests_voided_by' 
        AND table_name = 'invoice_requests'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_requests 
        ADD CONSTRAINT fk_invoice_requests_voided_by 
        FOREIGN KEY (voided_by) REFERENCES public.profiles(id);
    END IF;

    -- 检查并添加partner_id外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_requests_partner_id' 
        AND table_name = 'invoice_requests'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_requests 
        ADD CONSTRAINT fk_invoice_requests_partner_id 
        FOREIGN KEY (partner_id) REFERENCES public.partners(id);
    END IF;

    -- 检查并添加invoicing_partner_id外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_requests_invoicing_partner_id' 
        AND table_name = 'invoice_requests'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_requests 
        ADD CONSTRAINT fk_invoice_requests_invoicing_partner_id 
        FOREIGN KEY (invoicing_partner_id) REFERENCES public.partners(id);
    END IF;
END $$;

-- 3. 为invoice_request_details表添加外键
DO $$
BEGIN
    -- 检查并添加invoice_request_id外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_request_details_request_id' 
        AND table_name = 'invoice_request_details'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_request_details 
        ADD CONSTRAINT fk_invoice_request_details_request_id 
        FOREIGN KEY (invoice_request_id) REFERENCES public.invoice_requests(id) ON DELETE CASCADE;
    END IF;

    -- 检查并添加logistics_record_id外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_request_details_record_id' 
        AND table_name = 'invoice_request_details'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_request_details 
        ADD CONSTRAINT fk_invoice_request_details_record_id 
        FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id);
    END IF;
END $$;

-- 4. 为logistics_partner_costs表添加外键
DO $$
BEGIN
    -- 检查并添加invoice_request_id外键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_logistics_partner_costs_invoice_request_id' 
        AND table_name = 'logistics_partner_costs'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_partner_costs 
        ADD CONSTRAINT fk_logistics_partner_costs_invoice_request_id 
        FOREIGN KEY (invoice_request_id) REFERENCES public.invoice_requests(id);
    END IF;
END $$;

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_invoice_requests_created_by ON public.invoice_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_partner_id ON public.invoice_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_invoicing_partner_id ON public.invoice_requests(invoicing_partner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON public.invoice_requests(status);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_created_at ON public.invoice_requests(created_at);

-- 6. 更新RLS策略以支持外键关系查询
DROP POLICY IF EXISTS "invoice_requests_select_policy" ON public.invoice_requests;
CREATE POLICY "invoice_requests_select_policy" ON public.invoice_requests
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'finance')
        ) OR
        created_by = auth.uid()
    );

-- 7. 确保所有表都启用了RLS
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_request_details ENABLE ROW LEVEL SECURITY;
