-- ============================================================================
-- 导出财务看板相关函数定义
-- ============================================================================
-- 用途: 导出当前数据库中财务看板相关的所有函数定义
-- 执行: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- 导出所有财务看板相关函数的完整定义
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    prorettype::regtype as return_type,
    pg_get_functiondef(oid) as function_definition,
    prosrc as source_code
FROM pg_proc
WHERE proname IN (
    'get_total_receivables',
    'get_monthly_receivables',
    'get_pending_payments',
    'get_pending_invoicing',
    'get_monthly_trends',
    'get_partner_ranking'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- ============================================================================
-- 使用说明
-- ============================================================================
-- 
-- 1. 运行上面的查询，获取所有函数的完整定义
-- 2. 复制 function_definition 列的内容
-- 3. 保存到文件或记录下来
-- 4. 如果需要恢复，直接执行这些函数定义即可
-- 
-- ============================================================================

