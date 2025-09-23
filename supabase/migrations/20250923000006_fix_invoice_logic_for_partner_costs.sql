-- 修正开票逻辑：操作对象改为logistics_partner_costs表
-- 文件: supabase/migrations/20250923000006_fix_invoice_logic_for_partner_costs.sql

BEGIN;

-- 1. 为logistics_partner_costs表添加开票和付款状态字段
ALTER TABLE logistics_partner_costs 
ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'Uninvoiced' 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid' 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Paid'));

-- 2. 添加开票和付款相关的时间戳字段
ALTER TABLE logistics_partner_costs
ADD COLUMN IF NOT EXISTS invoice_applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invoice_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;

-- 3. 添加发票和付款相关信息字段
ALTER TABLE logistics_partner_costs
ADD COLUMN IF NOT EXISTS invoice_request_id UUID REFERENCES invoice_requests(id),
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS payment_request_id UUID,
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- 4. 为新字段添加索引
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_invoice_status 
ON logistics_partner_costs(invoice_status);

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_payment_status 
ON logistics_partner_costs(payment_status);

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_partner_status 
ON logistics_partner_costs(partner_id, invoice_status, payment_status);

-- 5. 为现有记录设置默认状态
UPDATE logistics_partner_costs 
SET 
    invoice_status = 'Uninvoiced',
    payment_status = 'Unpaid'
WHERE invoice_status IS NULL OR payment_status IS NULL;

-- 6. 添加字段注释
COMMENT ON COLUMN logistics_partner_costs.invoice_status IS '开票状态: Uninvoiced-未开票, Processing-已申请开票, Invoiced-已完成开票';
COMMENT ON COLUMN logistics_partner_costs.payment_status IS '付款状态: Unpaid-未付款, Processing-已申请付款, Paid-已完成付款';
COMMENT ON COLUMN logistics_partner_costs.invoice_applied_at IS '开票申请时间';
COMMENT ON COLUMN logistics_partner_costs.invoice_completed_at IS '开票完成时间';
COMMENT ON COLUMN logistics_partner_costs.payment_applied_at IS '付款申请时间';
COMMENT ON COLUMN logistics_partner_costs.payment_completed_at IS '付款完成时间';
COMMENT ON COLUMN logistics_partner_costs.invoice_request_id IS '关联的开票申请ID';
COMMENT ON COLUMN logistics_partner_costs.payment_request_id IS '关联的付款申请ID';

-- 7. 如果logistics_records表已经添加了invoice_status字段，我们需要删除它
-- 因为状态应该在partner_costs级别管理
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'logistics_records' AND column_name = 'invoice_status') THEN
        ALTER TABLE logistics_records DROP COLUMN invoice_status;
        RAISE NOTICE '已删除logistics_records表中的invoice_status字段，状态管理转移到logistics_partner_costs表';
    END IF;
END $$;

-- 8. 创建视图来汇总运单的开票和付款状态
CREATE OR REPLACE VIEW logistics_records_status_summary AS
SELECT 
    lr.id as logistics_record_id,
    lr.auto_number,
    lr.project_name,
    lr.driver_name,
    lr.loading_date,
    -- 开票状态汇总
    CASE 
        WHEN COUNT(lpc.id) = 0 THEN 'No Partners'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Invoiced') = COUNT(lpc.id) THEN 'All Invoiced'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Processing') > 0 THEN 'Partially Processing'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Invoiced') > 0 THEN 'Partially Invoiced'
        ELSE 'Uninvoiced'
    END as overall_invoice_status,
    -- 付款状态汇总
    CASE 
        WHEN COUNT(lpc.id) = 0 THEN 'No Partners'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Paid') = COUNT(lpc.id) THEN 'All Paid'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Processing') > 0 THEN 'Partially Processing'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Paid') > 0 THEN 'Partially Paid'
        ELSE 'Unpaid'
    END as overall_payment_status,
    -- 统计信息
    COUNT(lpc.id) as total_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Uninvoiced') as uninvoiced_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Processing') as invoice_processing_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Invoiced') as invoiced_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Unpaid') as unpaid_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Processing') as payment_processing_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Paid') as paid_partners,
    -- 金额汇总
    COALESCE(SUM(lpc.payable_amount), 0) as total_payable_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.invoice_status = 'Uninvoiced'), 0) as uninvoiced_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.invoice_status = 'Invoiced'), 0) as invoiced_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.payment_status = 'Unpaid'), 0) as unpaid_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.payment_status = 'Paid'), 0) as paid_amount
FROM logistics_records lr
LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
GROUP BY lr.id, lr.auto_number, lr.project_name, lr.driver_name, lr.loading_date;

-- 9. 创建触发器函数，当partner_costs状态变化时自动更新相关时间戳
CREATE OR REPLACE FUNCTION update_partner_costs_timestamps()
RETURNS TRIGGER AS $$
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
        IF NEW.payment_status = 'Processing' AND OLD.payment_status = 'Unpaid' THEN
            NEW.payment_applied_at = NOW();
        ELSIF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Processing' THEN
            NEW.payment_completed_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. 创建触发器
CREATE TRIGGER trigger_update_partner_costs_timestamps
    BEFORE UPDATE ON logistics_partner_costs
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_costs_timestamps();

COMMIT;
