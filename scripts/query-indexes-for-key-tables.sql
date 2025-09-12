-- 查询关键表的索引信息
-- 执行这些查询来了解表的索引设计

-- 1. 查询 payment_requests 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'payment_requests' 
    AND schemaname = 'public';

-- 2. 查询 invoice_records 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'invoice_records' 
    AND schemaname = 'public';

-- 3. 查询 partner_payment_requests 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_payment_requests' 
    AND schemaname = 'public';

-- 4. 查询 partner_payment_items 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_payment_items' 
    AND schemaname = 'public';

-- 5. 查询 partner_bank_details 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_bank_details' 
    AND schemaname = 'public';

-- 6. 查询 permission_audit_logs 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'permission_audit_logs' 
    AND schemaname = 'public';

-- 7. 查询 saved_searches 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'saved_searches' 
    AND schemaname = 'public';

-- 8. 查询 waybill_fingerprint 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'waybill_fingerprint' 
    AND schemaname = 'public';

-- 9. 查询 external_platforms 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'external_platforms' 
    AND schemaname = 'public';
