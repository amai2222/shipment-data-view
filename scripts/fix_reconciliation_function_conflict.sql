-- ============================================================================
-- 修复 get_finance_reconciliation_by_partner_1116 函数冲突
-- 日期：2025-11-16
-- 说明：删除旧版本函数，确保只保留包含对账状态参数的版本
-- ============================================================================

-- 1. 查看所有同名函数的参数列表
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    p.oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_finance_reconciliation_by_partner_1116'
ORDER BY p.oid;

-- 2. 删除没有 p_reconciliation_status 参数的旧版本（如果存在）
-- 注意：这个版本有11个参数（没有 p_reconciliation_status）
DROP FUNCTION IF EXISTS public.get_finance_reconciliation_by_partner_1116(
    text,      -- p_project_id
    date,      -- p_start_date
    date,      -- p_end_date
    uuid,      -- p_partner_id
    integer,   -- p_page_number
    integer,   -- p_page_size
    text,      -- p_driver_name
    text,      -- p_license_plate
    text,      -- p_driver_phone
    text,      -- p_waybill_numbers
    text       -- p_other_platform_name
);

-- 3. 验证：再次查看所有同名函数
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    p.oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_finance_reconciliation_by_partner_1116'
ORDER BY p.oid;

-- 4. 如果还有多个版本，请手动检查并删除不需要的版本
-- 应该只保留包含 p_reconciliation_status 参数的版本（12个参数）

