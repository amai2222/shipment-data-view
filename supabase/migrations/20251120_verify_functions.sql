-- ============================================================================
-- 验证 _1120 版本函数是否存在
-- 日期：2025-11-20
-- ============================================================================

-- 查询所有 _1120 函数
SELECT 
    proname AS function_name,
    pg_get_function_arguments(oid) AS arguments,
    pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname LIKE '%_1120%'
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 如果上面没有结果，说明函数还没创建
-- 请按顺序执行以下文件：
-- 1. supabase/migrations/20251120_update_summary_support_pieces.sql
-- 2. supabase/migrations/20251120_update_all_filtered_records_function.sql

