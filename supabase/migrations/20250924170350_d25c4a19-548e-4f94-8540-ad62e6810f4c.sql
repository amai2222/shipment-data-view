-- 修复开票申请合作方数据显示问题
-- 问题：get_invoice_request_data函数返回的partner_costs为空

-- 首先检查数据
SELECT 
    lr.auto_number,
    lr.id,
    COUNT(lpc.id) as partner_costs_count
FROM logistics_records lr
LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
WHERE lr.loading_date >= '2025-09-05' AND lr.loading_date <= '2025-09-08'
GROUP BY lr.id, lr.auto_number
HAVING COUNT(lpc.id) > 0
ORDER BY lr.loading_date DESC
LIMIT 10;