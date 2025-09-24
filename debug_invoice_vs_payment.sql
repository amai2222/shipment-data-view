-- 调试开票申请vs付款申请的数据差异
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 检查这些运单在logistics_partner_costs表中的数据
SELECT 
    lr.auto_number,
    lr.payment_status,
    lr.invoice_status,
    lpc.partner_id,
    p.name as partner_name,
    lpc.level,
    lpc.payable_amount,
    lpc.payment_status as lpc_payment_status,
    lpc.invoice_status as lpc_invoice_status
FROM logistics_records lr
JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
JOIN partners p ON lpc.partner_id = p.id
WHERE lr.auto_number IN ('YDN20250908-001', 'YDN20250906-026', 'YDN20250906-025')
ORDER BY lr.auto_number, lpc.level;

-- 2. 检查logistics_records_view中是否有这些运单
SELECT 
    id,
    auto_number,
    project_name,
    driver_name,
    loading_date
FROM logistics_records_view 
WHERE auto_number IN ('YDN20250908-001', 'YDN20250906-026', 'YDN20250906-025')
ORDER BY loading_date DESC;

-- 3. 测试付款申请的RPC函数（如果存在）
-- 注意：这里需要您提供付款申请的实际RPC函数名
-- SELECT public.get_payment_request_data(
--     NULL,  -- p_project_id
--     '2025-09-06'::date,  -- p_start_date
--     '2025-09-08'::date,  -- p_end_date
--     NULL,  -- p_partner_id
--     ARRAY['Unpaid'],  -- p_payment_status_array
--     5,     -- p_page_size
--     1      -- p_page_number
-- ) as payment_result;

-- 4. 测试开票申请的RPC函数
SELECT public.get_invoice_request_data(
    NULL,  -- p_project_id
    '2025-09-06'::date,  -- p_start_date
    '2025-09-08'::date,  -- p_end_date
    NULL,  -- p_partner_id
    ARRAY['Uninvoiced'],  -- p_invoice_status_array
    5,     -- p_page_size
    1      -- p_page_number
) as invoice_result;
