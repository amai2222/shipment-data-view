-- ============================================================================
-- 添加 payment_records 和 invoice_records 表的金额字段
-- 创建时间: 2025-11-24
-- 问题：payment_records 和 invoice_records 表缺少金额字段
-- 解决：添加 payment_amount 和 invoice_amount 字段
-- ============================================================================

-- 1. 为 payment_records 表添加 payment_amount 字段
ALTER TABLE public.payment_records
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(15,2);

COMMENT ON COLUMN public.payment_records.payment_amount IS '付款金额（元）';

-- 2. 为 invoice_records 表添加 invoice_amount 字段
ALTER TABLE public.invoice_records
ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(15,2);

COMMENT ON COLUMN public.invoice_records.invoice_amount IS '开票金额（元）';

-- ============================================================================
-- 完成
-- ============================================================================

SELECT '✅ payment_records 和 invoice_records 表的金额字段已添加' AS status;

