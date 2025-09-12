-- 查询剩余的付款和开票相关表的索引信息
-- 执行这些查询来了解表的索引设计

-- 1. 查询 invoice_records 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'invoice_records' 
    AND schemaname = 'public';

-- 2. 查询 partner_payment_requests 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_payment_requests' 
    AND schemaname = 'public';

-- 3. 查询 partner_payment_items 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_payment_items' 
    AND schemaname = 'public';
