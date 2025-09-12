-- 查询核心付款相关表的结构
-- 按顺序执行这些查询

-- 1. 查询 payment_requests 表结构（付款申请核心表）
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

-- 2. 查询 invoice_records 表结构（开票记录表）
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

-- 3. 查询 logistics_records 表的 payment_status 相关字段（运单支付状态）
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
         OR column_name LIKE '%invoice%'
         OR column_name = 'payment_status')
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
