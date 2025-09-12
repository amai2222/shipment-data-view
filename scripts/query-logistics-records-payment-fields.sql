-- 专门查询 logistics_records 表的支付相关字段
-- 这个查询特别重要，因为涉及到支付状态筛选功能

-- 1. 查询 logistics_records 表的完整结构（重点关注支付相关字段）
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 查询 logistics_records 表的 payment_status 字段详细信息
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

-- 3. 查询 logistics_records 表的所有状态相关字段
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

-- 4. 查询 logistics_records 表的所有支付相关字段
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

-- 5. 查询 logistics_records 表的外键约束（了解与其他表的关系）
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
    AND tc.table_name = 'logistics_records'
    AND tc.table_schema = 'public';
