-- 测试修复后的司机项目关联功能
-- 文件: test_fixed_driver_association.sql

-- 1. 测试查找司机项目函数（修复字段冲突）
SELECT 'Testing find_driver_projects function...' as test_name;

-- 获取一些司机ID进行测试
WITH test_drivers AS (
  SELECT id FROM public.drivers LIMIT 3
)
SELECT * FROM public.find_driver_projects(
  ARRAY(SELECT id FROM test_drivers)
);

-- 2. 测试预览关联函数
SELECT 'Testing preview_driver_project_association function...' as test_name;

WITH test_drivers AS (
  SELECT id FROM public.drivers LIMIT 3
)
SELECT * FROM public.preview_driver_project_association(
  ARRAY(SELECT id FROM test_drivers)
);

-- 3. 测试司机分页查询函数
SELECT 'Testing get_drivers_paginated function...' as test_name;

SELECT * FROM public.get_drivers_paginated(1, 5, '');

-- 4. 检查表结构，确认字段名
SELECT 'Checking table structures...' as test_name;

-- 检查drivers表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'drivers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 检查driver_projects表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_projects' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 检查logistics_records表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'logistics_records' AND table_schema = 'public'
ORDER BY ordinal_position;
