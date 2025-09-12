-- 查询数据库函数和Edge函数的SQL命令
-- 请在Supabase SQL编辑器中执行

-- 1. 查询所有数据库函数（详细版）
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    l.lanname as language,
    p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- 2. 查询所有数据库函数（简化版）
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- 3. 查询特定类型的函数
-- 导入相关函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND proname LIKE '%import%'
ORDER BY proname;

-- 4. 查询删除相关函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND proname LIKE '%delete%'
ORDER BY proname;

-- 5. 查询统计相关函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND (proname LIKE '%stats%' OR proname LIKE '%dashboard%' OR proname LIKE '%count%')
ORDER BY proname;

-- 6. 查询成本计算相关函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND (proname LIKE '%cost%' OR proname LIKE '%calculate%' OR proname LIKE '%recalculate%')
ORDER BY proname;

-- 7. 查询所有触发器函数
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.prosrc LIKE '%TRIGGER%'
ORDER BY proname;

-- 8. 查询所有自定义类型
SELECT 
    typname as type_name,
    typtype as type_type,
    typcategory as type_category
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
    AND t.typtype = 'c'  -- 复合类型
ORDER BY typname;
