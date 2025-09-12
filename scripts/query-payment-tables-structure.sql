-- 查询付款相关表的结构
-- 执行这些SQL语句来获取准确的表结构信息

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

-- 2. 查询 payment_records 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'payment_records' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 查询 invoice_records 表结构
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

-- 4. 查询 logistics_records 表的 payment_status 相关字段
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
    AND table_schema = 'public'
    AND column_name LIKE '%payment%' OR column_name LIKE '%status%'
ORDER BY ordinal_position;

-- 5. 查询所有付款相关的表名
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND (table_name LIKE '%payment%' 
         OR table_name LIKE '%invoice%'
         OR table_name LIKE '%finance%')
ORDER BY table_name;

-- 6. 查询 payment_requests 表的外键约束
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'payment_requests'
    AND tc.table_schema = 'public';

-- 7. 查询 payment_records 表的外键约束
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'payment_records'
    AND tc.table_schema = 'public';

-- 8. 查询所有与付款相关的函数
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND (routine_name LIKE '%payment%' 
         OR routine_name LIKE '%invoice%'
         OR routine_name LIKE '%finance%')
ORDER BY routine_name;

-- 9. 查询 payment_requests 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'payment_requests' 
    AND schemaname = 'public';

-- 10. 查询 payment_records 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'payment_records' 
    AND schemaname = 'public';
