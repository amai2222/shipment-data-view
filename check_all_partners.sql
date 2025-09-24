-- 检查allPartners数据
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 检查所有合作方数据
SELECT 
    id,
    name,
    level
FROM partners 
ORDER BY level, name;

-- 2. 检查RPC函数返回的partner_invoiceables中的合作方ID
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
    )->>'partner_id' as partner_id_from_rpc;

-- 3. 检查这些合作方ID是否在partners表中存在
SELECT 
    p.id,
    p.name,
    p.level,
    CASE 
        WHEN p.id IN (
            '92dbcd9b-5497-4caf-b56a-bb58542af7c7',
            '3ef4732a-a08d-483d-981a-bb91070c7e36',
            '130046c4-a14a-41c0-ba7b-b4775004daaf',
            'b51c8eb3-5d75-4acb-bded-2760e94461e3',
            '5b60ba13-2468-46c1-ab5f-5ba34ca18c89'
        ) THEN 'RPC中有数据'
        ELSE 'RPC中无数据'
    END as status
FROM partners p
ORDER BY p.level, p.name;
