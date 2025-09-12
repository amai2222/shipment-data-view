-- 快速检查付款相关表的基本信息
-- 这些查询比较轻量，可以快速执行

-- 1. 检查 payment_requests 表是否存在及其基本结构
SELECT 
    'payment_requests' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'payment_requests' AND table_schema = 'public';

-- 2. 检查 payment_records 表是否存在及其基本结构
SELECT 
    'payment_records' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'payment_records' AND table_schema = 'public';

-- 3. 检查 invoice_records 表是否存在及其基本结构
SELECT 
    'invoice_records' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'invoice_records' AND table_schema = 'public';

-- 4. 检查 logistics_records 表是否有 payment_status 字段
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
    AND table_schema = 'public'
    AND column_name = 'payment_status';

-- 5. 检查所有包含 'payment' 的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%payment%';

-- 6. 检查所有包含 'request' 的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%request%';

-- 7. 检查所有包含 'invoice' 的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%invoice%';

-- 8. 检查所有包含 'approval' 的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%approval%';

-- 9. 检查所有包含 'work' 的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%work%';

-- 10. 检查所有包含 'wechat' 的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%wechat%';
