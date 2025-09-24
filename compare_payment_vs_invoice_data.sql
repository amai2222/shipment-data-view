-- 比较付款申请和开票申请的数据差异
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 检查付款申请页面可能显示的运单（payment_status = 'Unpaid'）
SELECT 
    lr.auto_number,
    lr.payment_status,
    lr.invoice_status,
    COUNT(lpc.id) as partner_costs_count
FROM logistics_records lr
LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
WHERE lr.payment_status = 'Unpaid'
GROUP BY lr.auto_number, lr.payment_status, lr.invoice_status
ORDER BY lr.auto_number
LIMIT 10;

-- 2. 检查开票申请页面显示的运单（invoice_status = 'Uninvoiced'）
SELECT 
    lr.auto_number,
    lr.payment_status,
    lr.invoice_status,
    COUNT(lpc.id) as partner_costs_count
FROM logistics_records lr
LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
WHERE lr.invoice_status = 'Uninvoiced' OR lr.invoice_status IS NULL
GROUP BY lr.auto_number, lr.payment_status, lr.invoice_status
ORDER BY lr.auto_number
LIMIT 10;

-- 3. 检查有合作方费用数据的运单的payment_status和invoice_status
SELECT 
    lr.auto_number,
    lr.payment_status,
    lr.invoice_status,
    COUNT(lpc.id) as partner_costs_count
FROM logistics_records lr
JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
GROUP BY lr.auto_number, lr.payment_status, lr.invoice_status
ORDER BY lr.auto_number
LIMIT 10;
