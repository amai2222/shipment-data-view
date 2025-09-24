-- 检查特定运单的合作方费用数据
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 检查这些运单在logistics_partner_costs表中是否有数据
SELECT 
    lr.auto_number,
    lr.id as logistics_record_id,
    COUNT(lpc.id) as partner_costs_count
FROM logistics_records lr
LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
WHERE lr.auto_number IN ('YDN20250908-001', 'YDN20250906-025', 'YDN20250906-026', 'YDN20250906-027', 'YDN20250905-030', 'YDN20250905-031')
GROUP BY lr.auto_number, lr.id
ORDER BY lr.auto_number;

-- 2. 检查这些运单的invoice_status
SELECT 
    auto_number,
    invoice_status,
    payment_status
FROM logistics_records 
WHERE auto_number IN ('YDN20250908-001', 'YDN20250906-025', 'YDN20250906-026', 'YDN20250906-027', 'YDN20250905-030', 'YDN20250905-031')
ORDER BY auto_number;

-- 3. 检查有合作方费用数据的运单示例
SELECT 
    lr.auto_number,
    lr.invoice_status,
    lpc.partner_id,
    p.name as partner_name,
    lpc.level,
    lpc.payable_amount
FROM logistics_records lr
JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
JOIN partners p ON lpc.partner_id = p.id
WHERE lr.auto_number IN ('202507030001', '202507030002', '202507030003')
ORDER BY lr.auto_number, lpc.level
LIMIT 10;

-- 4. 检查这些运单是否在logistics_records表中存在
SELECT 
    id,
    auto_number,
    invoice_status,
    payment_status,
    created_at
FROM logistics_records 
WHERE auto_number IN ('YDN20250908-001', 'YDN20250906-025', 'YDN20250906-026', 'YDN20250906-027', 'YDN20250905-030', 'YDN20250905-031')
ORDER BY auto_number;
