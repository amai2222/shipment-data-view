-- 检查 delete_waybills_by_project 函数状态
-- 用于诊断函数是否存在以及参数是否正确

-- 1. 检查函数是否存在
SELECT 
    proname as function_name,
    proargnames as argument_names,
    proargtypes::regtype[] as argument_types,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'delete_waybills_by_project';

-- 2. 检查函数参数详情
SELECT 
    specific_name,
    parameter_name,
    parameter_mode,
    data_type,
    ordinal_position
FROM information_schema.parameters 
WHERE specific_schema = 'public' 
    AND specific_name IN (
        SELECT specific_name 
        FROM information_schema.routines 
        WHERE routine_name = 'delete_waybills_by_project'
    )
ORDER BY ordinal_position;

-- 3. 检查所有删除相关的函数
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%delete%'
ORDER BY routine_name;

-- 4. 检查项目表数据（用于测试）
SELECT 
    id,
    name,
    status
FROM public.projects 
WHERE name = '可口可乐'
LIMIT 5;

-- 5. 检查运单记录数据（用于测试）
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN project_name = '可口可乐' THEN 1 END) as coca_cola_records
FROM public.logistics_records;
