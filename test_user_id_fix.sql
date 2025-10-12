-- 测试修复后的司机项目关联功能（包含user_id）
-- 文件: test_user_id_fix.sql

-- 1. 检查driver_projects表结构
SELECT 'Checking driver_projects table structure...' as test_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'driver_projects' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查当前用户
SELECT 'Checking current user...' as test_name;

SELECT auth.uid() as current_user_id;

-- 3. 测试批量关联函数（使用少量司机进行测试）
SELECT 'Testing batch_associate_driver_projects function...' as test_name;

-- 获取前3个司机ID进行测试
WITH test_drivers AS (
  SELECT id FROM public.drivers LIMIT 3
)
SELECT public.batch_associate_driver_projects(
  ARRAY(SELECT id FROM test_drivers)
) as result;

-- 4. 检查关联结果
SELECT 'Checking association results...' as test_name;

SELECT 
    dp.driver_id,
    d.name as driver_name,
    dp.project_id,
    p.name as project_name,
    dp.user_id,
    dp.created_at
FROM public.driver_projects dp
JOIN public.drivers d ON dp.driver_id = d.id
JOIN public.projects p ON dp.project_id = p.id
ORDER BY dp.created_at DESC
LIMIT 10;

-- 5. 测试预览函数
SELECT 'Testing preview function...' as test_name;

WITH test_drivers AS (
  SELECT id FROM public.drivers LIMIT 3
)
SELECT public.preview_driver_project_association(
  ARRAY(SELECT id FROM test_drivers)
) as preview_result;
