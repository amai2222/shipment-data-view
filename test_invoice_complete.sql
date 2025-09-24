-- 完整的开票申请测试SQL
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 测试开票申请RPC函数 - 查看返回的运单数量
SELECT 
    (public.get_invoice_request_data(
        NULL,  -- p_project_id
        '2025-09-05'::date,  -- p_start_date
        '2025-09-08'::date,  -- p_end_date
        NULL,  -- p_partner_id
        ARRAY['Uninvoiced'],  -- p_invoice_status_array
        50,    -- p_page_size
        1      -- p_page_number
    )->>'count')::integer as total_count;

-- 2. 检查应该返回的运单数量（手动查询对比）
SELECT COUNT(*) as should_return_count
FROM logistics_records_view v
JOIN logistics_records lr ON v.id = lr.id
WHERE 
    (v.loading_date::date >= '2025-09-05') AND
    (v.loading_date::date <= '2025-09-08') AND
    (COALESCE(lr.invoice_status, 'Uninvoiced') = 'Uninvoiced');

-- 3. 查看RPC函数返回的具体运单列表
SELECT 
    jsonb_array_elements(
        (public.get_invoice_request_data(
            NULL,  -- p_project_id
            '2025-09-05'::date,  -- p_start_date
            '2025-09-08'::date,  -- p_end_date
            NULL,  -- p_partner_id
            ARRAY['Uninvoiced'],  -- p_invoice_status_array
            50,    -- p_page_size
            1      -- p_page_number
        )->'records')
    )->>'auto_number' as returned_waybills
ORDER BY returned_waybills;

-- 4. 检查这些运单的合作方费用数据情况
SELECT 
    v.auto_number,
    v.loading_date,
    lr.invoice_status,
    COUNT(lpc.id) as partner_costs_count,
    CASE 
        WHEN COUNT(lpc.id) > 0 THEN '有合作方数据'
        ELSE '无合作方数据'
    END as data_status
FROM logistics_records_view v
JOIN logistics_records lr ON v.id = lr.id
LEFT JOIN logistics_partner_costs lpc ON v.id = lpc.logistics_record_id
WHERE 
    (v.loading_date::date >= '2025-09-05') AND
    (v.loading_date::date <= '2025-09-08') AND
    (COALESCE(lr.invoice_status, 'Uninvoiced') = 'Uninvoiced')
GROUP BY v.auto_number, v.loading_date, lr.invoice_status
ORDER BY v.loading_date DESC, v.auto_number;

-- 5. 检查partner_invoiceables数据
SELECT 
    jsonb_array_elements(
        (public.get_invoice_request_data(
            NULL,  -- p_project_id
            '2025-09-05'::date,  -- p_start_date
            '2025-09-08'::date,  -- p_end_date
            NULL,  -- p_partner_id
            ARRAY['Uninvoiced'],  -- p_invoice_status_array
            50,    -- p_page_size
            1      -- p_page_number
        )->'partner_invoiceables')
    ) as partner_data;
