-- ============================================================================
-- 检查是否存在重复的 get_finance_reconciliation_by_partner_1116 函数
-- ============================================================================

-- 查看所有同名函数的参数列表
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    p.oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_finance_reconciliation_by_partner_1116'
ORDER BY p.oid;

-- 如果存在多个版本，需要删除旧版本
-- 注意：请根据实际情况选择要保留的版本

-- 示例：删除没有 p_reconciliation_status 参数的版本
-- DROP FUNCTION IF EXISTS public.get_finance_reconciliation_by_partner_1116(
--     text, date, date, uuid, integer, integer, text, text, text, text, text
-- );

