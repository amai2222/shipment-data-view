-- 简化的司机数据测试脚本
-- 文件: test-driver-simple.sql

-- 1. 测试基本连接
SELECT 'Testing basic connection...' as test_name;
SELECT COUNT(*) as driver_count FROM public.drivers;

-- 2. 测试RPC函数（如果存在）
SELECT 'Testing RPC function...' as test_name;
SELECT * FROM public.get_drivers_paginated(1, 5, '') LIMIT 1;

-- 3. 检查表结构
SELECT 'Checking table structure...' as test_name;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'drivers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 检查RLS策略
SELECT 'Checking RLS policies...' as test_name;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'drivers';

-- 5. 测试直接查询
SELECT 'Testing direct query...' as test_name;
SELECT id, name, license_plate, phone, created_at 
FROM public.drivers 
LIMIT 3;
