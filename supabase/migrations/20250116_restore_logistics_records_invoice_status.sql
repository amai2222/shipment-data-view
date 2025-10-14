-- 恢复 logistics_records 表的 invoice_status 字段
-- 确保开票申请管理和开票管理都能正确操作 logistics_records.invoice_status

BEGIN;

-- 1. 检查并添加 invoice_status 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'invoice_status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records 
        ADD COLUMN invoice_status VARCHAR(20) DEFAULT 'Uninvoiced' 
        CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));
        
        RAISE NOTICE '已添加 logistics_records.invoice_status 字段';
    ELSE
        RAISE NOTICE 'logistics_records.invoice_status 字段已存在';
    END IF;
END $$;

-- 2. 检查并添加 payment_status 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'payment_status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records 
        ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Uninvoiced' 
        CHECK (payment_status IN ('Uninvoiced', 'Processing', 'Invoiced'));
        
        RAISE NOTICE '已添加 logistics_records.payment_status 字段';
    ELSE
        RAISE NOTICE 'logistics_records.payment_status 字段已存在';
    END IF;
END $$;

-- 3. 检查并添加时间戳字段
DO $$
BEGIN
    -- 开票相关时间戳
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'invoice_applied_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN invoice_applied_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'invoice_completed_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN invoice_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- 付款相关时间戳
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'payment_applied_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN payment_applied_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'payment_completed_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN payment_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 4. 为现有记录设置默认状态
UPDATE public.logistics_records 
SET 
    invoice_status = COALESCE(invoice_status, 'Uninvoiced'),
    payment_status = COALESCE(payment_status, 'Uninvoiced')
WHERE invoice_status IS NULL OR payment_status IS NULL;

-- 5. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status 
ON public.logistics_records(invoice_status);

CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_status 
ON public.logistics_records(payment_status);

CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_request_id 
ON public.logistics_records(invoice_request_id);

CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_request_id 
ON public.logistics_records(payment_request_id);

-- 6. 添加字段注释
COMMENT ON COLUMN public.logistics_records.invoice_status IS '开票状态: Uninvoiced(未开票), Processing(开票中), Invoiced(已开票)';
COMMENT ON COLUMN public.logistics_records.payment_status IS '付款状态: Uninvoiced(未付款), Processing(付款中), Invoiced(已付款)';
COMMENT ON COLUMN public.logistics_records.invoice_applied_at IS '开票申请时间';
COMMENT ON COLUMN public.logistics_records.invoice_completed_at IS '开票完成时间';
COMMENT ON COLUMN public.logistics_records.payment_applied_at IS '付款申请时间';
COMMENT ON COLUMN public.logistics_records.payment_completed_at IS '付款完成时间';

COMMIT;
