-- 检查 drivers 表的所有约束
-- 用于诊断司机表的结构问题

-- 1. 查看 drivers 表的所有约束
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.drivers'::regclass
ORDER BY contype, conname;

-- 2. 查看 drivers 表的结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'drivers' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 查看 drivers 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'drivers' 
    AND schemaname = 'public';

-- 4. 检查是否有重复的司机姓名+车牌号组合
SELECT 
    name,
    license_plate,
    COUNT(*) as count
FROM public.drivers 
GROUP BY name, license_plate
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 5. 查看司机"孙振"的记录
SELECT 
    id,
    name,
    license_plate,
    phone,
    created_at
FROM public.drivers 
WHERE name = '孙振'
ORDER BY created_at DESC;
