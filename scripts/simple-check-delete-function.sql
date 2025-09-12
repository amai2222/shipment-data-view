-- 简化版检查 delete_waybills_by_project 函数状态脚本
-- 避免字段不存在的错误

-- 1. 简单检查函数是否存在
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'delete_waybills_by_project'
        ) 
        THEN '函数存在' 
        ELSE '函数不存在' 
    END as function_status;

-- 2. 如果函数存在，查看函数基本信息
SELECT 
    proname as function_name,
    proargnames as argument_names,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'delete_waybills_by_project';

-- 3. 检查项目表结构（避免字段错误）
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 检查项目数据（只查询存在的字段）
SELECT 
    id,
    name
FROM public.projects 
WHERE name = '可口可乐'
LIMIT 5;

-- 5. 检查运单记录数据
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN project_name = '可口可乐' THEN 1 END) as coca_cola_records
FROM public.logistics_records;

-- 6. 检查所有删除相关的函数
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%delete%'
ORDER BY routine_name;
