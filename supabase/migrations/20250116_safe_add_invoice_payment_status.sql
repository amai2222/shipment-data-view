-- 安全地为logistics_records表添加开票和付款状态字段
-- 文件: supabase/migrations/20250116_safe_add_invoice_payment_status.sql

BEGIN;

-- 1. 检查并添加开票和付款状态字段
DO $$
BEGIN
    -- 检查并添加invoice_status字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'invoice_status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records 
        ADD COLUMN invoice_status TEXT DEFAULT 'Uninvoiced' 
        CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));
    END IF;

    -- 检查并添加payment_status字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'payment_status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records 
        ADD COLUMN payment_status TEXT DEFAULT 'Uninvoiced' 
        CHECK (payment_status IN ('Uninvoiced', 'Processing', 'Paid'));
    END IF;
END $$;

-- 2. 添加时间戳字段
DO $$
BEGIN
    -- 添加开票相关时间戳字段
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

    -- 添加付款相关时间戳字段
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

-- 3. 添加关联字段
DO $$
BEGIN
    -- 添加开票关联字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'invoice_request_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN invoice_request_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'invoice_number'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN invoice_number TEXT;
    END IF;

    -- 添加付款关联字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'payment_request_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN payment_request_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'payment_reference'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.logistics_records
        ADD COLUMN payment_reference TEXT;
    END IF;
END $$;

-- 4. 为现有记录设置默认状态
UPDATE public.logistics_records 
SET 
    invoice_status = 'Uninvoiced',
    payment_status = 'Uninvoiced'
WHERE invoice_status IS NULL OR payment_status IS NULL;

-- 5. 添加索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status 
ON public.logistics_records(invoice_status);

CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_status 
ON public.logistics_records(payment_status);

CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_request_id 
ON public.logistics_records(invoice_request_id);

CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_request_id 
ON public.logistics_records(payment_request_id);

-- 6. 添加字段注释
COMMENT ON COLUMN public.logistics_records.invoice_status IS '开票状态: Uninvoiced-未开票, Processing-已申请开票, Invoiced-已完成开票';
COMMENT ON COLUMN public.logistics_records.payment_status IS '付款状态: Uninvoiced-未开票, Processing-已申请付款, Paid-已完成付款';
COMMENT ON COLUMN public.logistics_records.invoice_applied_at IS '开票申请时间';
COMMENT ON COLUMN public.logistics_records.invoice_completed_at IS '开票完成时间';
COMMENT ON COLUMN public.logistics_records.payment_applied_at IS '付款申请时间';
COMMENT ON COLUMN public.logistics_records.payment_completed_at IS '付款完成时间';
COMMENT ON COLUMN public.logistics_records.invoice_request_id IS '关联的开票申请ID';
COMMENT ON COLUMN public.logistics_records.invoice_number IS '发票号码';
COMMENT ON COLUMN public.logistics_records.payment_request_id IS '关联的付款申请ID';
COMMENT ON COLUMN public.logistics_records.payment_reference IS '付款参考号';

-- 7. 创建触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_logistics_records_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 开票状态变化时更新时间戳
    IF OLD.invoice_status IS DISTINCT FROM NEW.invoice_status THEN
        IF NEW.invoice_status = 'Processing' AND OLD.invoice_status = 'Uninvoiced' THEN
            NEW.invoice_applied_at = NOW();
        ELSIF NEW.invoice_status = 'Invoiced' AND OLD.invoice_status = 'Processing' THEN
            NEW.invoice_completed_at = NOW();
        END IF;
    END IF;
    
    -- 付款状态变化时更新时间戳
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        IF NEW.payment_status = 'Processing' AND OLD.payment_status = 'Uninvoiced' THEN
            NEW.payment_applied_at = NOW();
        ELSIF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Processing' THEN
            NEW.payment_completed_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 8. 创建触发器（如果不存在）
DROP TRIGGER IF EXISTS trigger_update_logistics_records_timestamps ON public.logistics_records;
CREATE TRIGGER trigger_update_logistics_records_timestamps
    BEFORE UPDATE ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_logistics_records_timestamps();

-- 9. 创建运单创建时的默认值触发器函数
CREATE OR REPLACE FUNCTION public.set_logistics_records_default_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 设置默认状态值
    IF NEW.invoice_status IS NULL THEN
        NEW.invoice_status = 'Uninvoiced';
    END IF;
    
    IF NEW.payment_status IS NULL THEN
        NEW.payment_status = 'Uninvoiced';
    END IF;
    
    RETURN NEW;
END;
$$;

-- 10. 创建运单创建时的默认值触发器
DROP TRIGGER IF EXISTS trigger_set_logistics_records_default_status ON public.logistics_records;
CREATE TRIGGER trigger_set_logistics_records_default_status
    BEFORE INSERT ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_logistics_records_default_status();

COMMIT;
