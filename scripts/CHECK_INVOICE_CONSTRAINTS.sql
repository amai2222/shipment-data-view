-- ============================================================================
-- 检查开票约束和函数是否正确部署
-- ============================================================================

-- 1. 检查logistics_records表的invoice_status约束
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.logistics_records'::regclass
  AND conname LIKE '%invoice_status%';

-- 2. 检查logistics_partner_costs表的invoice_status约束  
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.logistics_partner_costs'::regclass
  AND conname LIKE '%invoice_status%';

-- 3. 检查新函数是否存在
SELECT 
    proname as function_name,
    prosrc LIKE '%Approved%' as contains_approved_status
FROM pg_proc 
WHERE proname IN (
    'approve_invoice_request_v2',
    'batch_approve_invoice_requests',
    'complete_invoice_request_v2',
    'batch_complete_invoice_requests',
    'cancel_invoice_request',
    'batch_cancel_invoice_requests'
)
ORDER BY proname;

-- 4. 测试约束 - 尝试设置Approved状态（应该成功）
-- 注释掉，仅用于手动测试
-- UPDATE logistics_records 
-- SET invoice_status = 'Approved'
-- WHERE id = (SELECT id FROM logistics_records LIMIT 1);

