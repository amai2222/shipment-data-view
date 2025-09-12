-- 查询剩余的付款和开票相关表结构
-- 按顺序执行这些查询

-- 1. 查询 invoice_records 表结构（开票记录表）
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

-- 2. 查询 partner_payment_requests 表结构（合作方付款申请表）
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

-- 3. 查询 partner_payment_items 表结构（合作方付款项目表）
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
