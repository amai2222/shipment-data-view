-- ============================================================================
-- 导出 is_admin() 函数定义
-- ============================================================================
-- 用途: 导出当前数据库中 is_admin() 函数的完整定义
-- 执行: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- 1. 显示函数的所有版本（可能有重载）
SELECT 
    '函数信息' as section,
    proname as function_name,
    pronargs as argument_count,
    pg_get_function_arguments(oid) as arguments,
    prorettype::regtype as return_type,
    prokind as function_type,
    prosecdef as security_definer,
    proconfig as settings
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace
ORDER BY pronargs;

-- 2. 导出函数定义（完整 SQL 语句）
SELECT 
    '完整函数定义' as section,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace
ORDER BY pronargs;

-- 3. 显示函数源代码（函数体内容）
SELECT 
    '函数源代码' as section,
    proname as function_name,
    prosrc as source_code,
    pg_get_function_identity_arguments(oid) as identity_args
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace
ORDER BY pronargs;

-- 4. 检查函数依赖关系
SELECT 
    '依赖关系' as section,
    objid::regprocedure as depends_on_function,
    refobjid::regprocedure as referenced_function
FROM pg_depend d
JOIN pg_proc p1 ON d.objid = p1.oid
JOIN pg_proc p2 ON d.refobjid = p2.oid
WHERE p1.proname = 'is_admin'
  AND p1.pronamespace = 'public'::regnamespace;

-- 5. 检查使用该函数的 RLS 策略
SELECT 
    'RLS策略使用' as section,
    schemaname,
    tablename,
    policyname,
    qual as using_expression
FROM pg_policies
WHERE qual::text LIKE '%is_admin%'
   OR with_check::text LIKE '%is_admin%';

-- ============================================================================
-- 导出说明
-- ============================================================================
-- 
-- 运行上述查询后：
-- 
-- 1. 复制"完整函数定义"的查询结果
-- 2. 保存到文件或记录下来
-- 3. 如果需要恢复，直接执行该函数定义即可
-- 
-- ============================================================================

