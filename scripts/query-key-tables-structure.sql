-- 查询关键表的具体结构信息
-- 按顺序执行这些查询

-- 1. 查询 payment_requests 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'payment_requests' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 查询 invoice_records 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'invoice_records' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 查询 logistics_records 表的 payment_status 相关字段
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
    AND table_schema = 'public'
    AND (column_name LIKE '%payment%' 
         OR column_name LIKE '%status%'
         OR column_name LIKE '%invoice%')
ORDER BY ordinal_position;

-- 4. 查询 partner_payment_requests 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'partner_payment_requests' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. 查询 partner_payment_items 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'partner_payment_items' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. 查询 partner_bank_details 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'partner_bank_details' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. 查询 permission_audit_logs 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'permission_audit_logs' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. 查询 saved_searches 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'saved_searches' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. 查询 waybill_fingerprint 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'waybill_fingerprint' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. 查询 external_platforms 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'external_platforms' 
    AND table_schema = 'public'
ORDER BY ordinal_position;
