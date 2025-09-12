-- 一次性查询所有剩余的付款和开票相关表结构
-- 执行这个脚本可以获取完整的付款系统数据库结构

-- ========================================
-- 1. 查询所有剩余表的基本结构
-- ========================================

-- 1.1 invoice_records 表结构（开票记录表）
SELECT 
    'invoice_records' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'invoice_records' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 1.2 partner_payment_requests 表结构（合作方付款申请表）
SELECT 
    'partner_payment_requests' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'partner_payment_requests' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 1.3 partner_payment_items 表结构（合作方付款项目表）
SELECT 
    'partner_payment_items' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'partner_payment_items' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- 2. 查询所有剩余表的外键关系
-- ========================================

-- 2.1 invoice_records 表外键
SELECT
    'invoice_records' as table_name,
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
    AND tc.table_name = 'invoice_records'
    AND tc.table_schema = 'public';

-- 2.2 partner_payment_requests 表外键
SELECT
    'partner_payment_requests' as table_name,
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
    AND tc.table_name = 'partner_payment_requests'
    AND tc.table_schema = 'public';

-- 2.3 partner_payment_items 表外键
SELECT
    'partner_payment_items' as table_name,
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
    AND tc.table_name = 'partner_payment_items'
    AND tc.table_schema = 'public';

-- ========================================
-- 3. 查询所有剩余表的索引信息
-- ========================================

-- 3.1 invoice_records 表索引
SELECT 
    'invoice_records' as table_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'invoice_records' 
    AND schemaname = 'public';

-- 3.2 partner_payment_requests 表索引
SELECT 
    'partner_payment_requests' as table_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_payment_requests' 
    AND schemaname = 'public';

-- 3.3 partner_payment_items 表索引
SELECT 
    'partner_payment_items' as table_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partner_payment_items' 
    AND schemaname = 'public';

-- ========================================
-- 4. 查询 logistics_records 表的完整支付相关字段
-- ========================================

-- 4.1 logistics_records 表所有支付相关字段
SELECT 
    'logistics_records' as table_name,
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
    AND (column_name LIKE '%payment%' 
         OR column_name LIKE '%pay%'
         OR column_name LIKE '%invoice%'
         OR column_name LIKE '%cost%'
         OR column_name LIKE '%amount%'
         OR column_name LIKE '%status%'
         OR column_name LIKE '%state%')
ORDER BY ordinal_position;

-- 4.2 logistics_records 表支付相关字段的索引
SELECT 
    'logistics_records' as table_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'logistics_records' 
    AND schemaname = 'public'
    AND (indexdef LIKE '%payment%' 
         OR indexdef LIKE '%status%'
         OR indexname LIKE '%payment%'
         OR indexname LIKE '%status%');

-- ========================================
-- 5. 查询所有付款相关表的行数统计
-- ========================================

SELECT 
    schemaname,
    relname as tablename,
    n_tup_ins as inserted_rows,
    n_tup_upd as updated_rows,
    n_tup_del as deleted_rows,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables 
WHERE relname IN (
    'invoice_records',
    'partner_payment_requests', 
    'partner_payment_items',
    'payment_requests',
    'payment_records',
    'logistics_records'
)
ORDER BY relname;
