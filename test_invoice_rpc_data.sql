-- 测试开票申请RPC函数返回的数据
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 直接测试开票申请RPC函数
SELECT public.get_invoice_request_data(
    NULL,  -- p_project_id
    '2025-09-05'::date,  -- p_start_date
    '2025-09-08'::date,  -- p_end_date
    NULL,  -- p_partner_id
    ARRAY['Uninvoiced'],  -- p_invoice_status_array
    5,     -- p_page_size
    1      -- p_page_number
) as invoice_result;

-- 2. 检查这些运单在logistics_partner_costs表中是否有数据
SELECT 
    lr.auto_number,
    lr.invoice_status,
    lpc.partner_id,
    p.name as partner_name,
    lpc.level,
    lpc.payable_amount,
    lpc.invoice_status as lpc_invoice_status
FROM logistics_records lr
JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
JOIN partners p ON lpc.partner_id = p.id
WHERE lr.auto_number IN ('YDN20250908-001', 'YDN20250906-026', 'YDN20250906-025', 'YDN20250906-027', 'YDN20250905-031', 'YDN20250905-030')
ORDER BY lr.auto_number, lpc.level;

-- 3. 检查logistics_records_view中是否有这些运单
SELECT 
    id,
    auto_number,
    project_name,
    driver_name,
    loading_date
FROM logistics_records_view 
WHERE auto_number IN ('YDN20250908-001', 'YDN20250906-026', 'YDN20250906-025', 'YDN20250906-027', 'YDN20250905-031', 'YDN20250905-030')
ORDER BY loading_date DESC;
