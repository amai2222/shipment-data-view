-- ============================================================
-- 备份：从数据库获取当前 update_project_chains_incremental 函数
-- ============================================================
-- 备份时间: 2025-11-10
-- 备份方式: 从数据库查询当前函数定义
-- ============================================================
-- 
-- ⚠️ 注意：此文件用于保存从数据库查询到的当前函数定义
-- 执行以下 SQL 查询可以获取完整的函数定义：
-- ============================================================

-- ============================================================
-- 方法1：查询函数定义（推荐）
-- ============================================================
SELECT 
    pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'update_project_chains_incremental'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================
-- 方法2：查询函数源码（如果方法1不完整）
-- ============================================================
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'update_project_chains_incremental'
  AND n.nspname = 'public';

-- ============================================================
-- 方法3：使用 psql 命令导出（如果使用命令行）
-- ============================================================
-- pg_dump -h your_host -U your_user -d your_database -t public.update_project_chains_incremental --schema-only
-- 
-- 或者使用以下 SQL 生成备份语句：
-- ============================================================
SELECT 
    'CREATE OR REPLACE FUNCTION ' || 
    pg_get_function_identity_arguments(p.oid) || E'\n' ||
    'RETURNS ' || pg_get_function_result(p.oid) || E'\n' ||
    'LANGUAGE ' || l.lanname || E'\n' ||
    'AS $function$' || E'\n' ||
    p.prosrc || E'\n' ||
    '$function$;' as backup_sql
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE p.proname = 'update_project_chains_incremental'
  AND n.nspname = 'public';

-- ============================================================
-- 方法4：直接查询 prosrc（函数源码）
-- ============================================================
SELECT 
    p.proname,
    p.prosrc as function_source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'update_project_chains_incremental'
  AND n.nspname = 'public';

