-- 测试司机项目关联功能
-- 文件: test_driver_association.sql

-- 1. 测试查找司机项目函数
SELECT * FROM public.find_driver_projects(
    ARRAY['550e8400-e29b-41d4-a716-446655440000'::uuid] -- 替换为实际的司机ID
);

-- 2. 测试预览关联函数
SELECT * FROM public.preview_driver_project_association(
    ARRAY['550e8400-e29b-41d4-a716-446655440000'::uuid] -- 替换为实际的司机ID
);

-- 3. 检查司机表数据
SELECT id, name, license_plate, phone FROM public.drivers LIMIT 5;

-- 4. 检查运单记录数据
SELECT driver_name, license_plate, driver_phone, project_name 
FROM public.logistics_records 
WHERE driver_name IS NOT NULL 
LIMIT 5;

-- 5. 检查司机项目关联表
SELECT dp.*, d.name as driver_name, p.name as project_name
FROM public.driver_projects dp
JOIN public.drivers d ON dp.driver_id = d.id
JOIN public.projects p ON dp.project_id = p.id
LIMIT 5;
