-- 专门查询 logistics_records 表的 payment_status 字段
-- 这个查询特别重要，因为涉及到支付状态筛选功能

-- 1. 查询 logistics_records 表的 payment_status 字段详细信息
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
    AND table_schema = 'public'
    AND column_name = 'payment_status';

-- 2. 查询 logistics_records 表的所有状态相关字段
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
    AND table_schema = 'public'
    AND (column_name LIKE '%status%' 
         OR column_name LIKE '%state%'
         OR column_name LIKE '%flag%')
ORDER BY ordinal_position;

-- 3. 查询 logistics_records 表的所有支付相关字段
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
         OR column_name LIKE '%pay%'
         OR column_name LIKE '%invoice%'
         OR column_name LIKE '%cost%'
         OR column_name LIKE '%amount%')
ORDER BY ordinal_position;

-- 4. 查询 logistics_records 表的索引（重点关注支付相关字段的索引）
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'logistics_records' 
    AND schemaname = 'public'
    AND (indexdef LIKE '%payment%' 
         OR indexdef LIKE '%status%'
         OR indexname LIKE '%payment%'
         OR indexname LIKE '%status%');
