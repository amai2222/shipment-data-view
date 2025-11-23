-- ============================================================================
-- 清理旧版本函数，只保留原函数名和最新版本
-- 日期：2025-11-23
-- ============================================================================
-- 功能：删除中间版本的函数，只保留原函数名和最新的带后缀版本
-- 
-- 保留策略：
-- 1. batch_recalculate_by_filter: 保留原函数和 _1120
-- 2. get_all_filtered_record_ids: 保留原函数和 _1120
-- 3. get_filtered_unpaid_ids: 保留原函数和 _1122
-- 4. get_finance_reconciliation_by_partner: 保留原函数和 _1122
-- 5. get_invoice_request_data: 保留原函数和 _1120
-- 6. get_invoice_requests_filtered: 保留原函数和 _1120
-- 7. get_logistics_summary_and_records_enhanced: 保留原函数和 _1120
-- 8. get_payment_request_data: 保留原函数和 _1122
-- 9. get_payment_requests_filtered: 保留原函数和 _1120
-- 10. get_shipper_dashboard_stats: 保留原函数和 _1120
-- 11. get_subordinate_shippers_stats: 保留原函数和 _1120
-- ============================================================================

-- 使用 DO 块动态删除所有重载版本的函数
DO $$ 
DECLARE
    r RECORD;
    function_names TEXT[] := ARRAY[
        'batch_recalculate_by_filter_1116',
        'get_all_filtered_record_ids_1113',
        'get_all_filtered_record_ids_1115',
        'get_all_filtered_record_ids_1116',
        'get_filtered_unpaid_ids_1116',
        'get_filtered_unpaid_ids_1120',
        'get_finance_reconciliation_by_partner_1115',
        'get_finance_reconciliation_by_partner_1116',
        'get_finance_reconciliation_by_partner_1120',
        'get_invoice_request_data_1113',
        'get_invoice_requests_filtered_1113',
        'get_invoice_requests_filtered_1114',
        'get_invoice_requests_filtered_1115',
        'get_invoice_requests_filtered_1116',
        'get_logistics_summary_and_records_enhanced_1113',
        'get_logistics_summary_and_records_enhanced_1115',
        'get_logistics_summary_and_records_enhanced_1116',
        'get_payment_request_data_1113',
        'get_payment_request_data_1116',
        'get_payment_request_data_1120',
        'get_payment_requests_filtered_1113',
        'get_payment_requests_filtered_1116',
        'get_shipper_dashboard_stats_1115',
        'get_subordinate_shippers_stats_1115'
    ];
    func_name TEXT;
BEGIN
    -- 遍历所有需要删除的函数名
    FOREACH func_name IN ARRAY function_names
    LOOP
        -- 删除该函数的所有重载版本
        FOR r IN 
            SELECT oid::regprocedure AS func_signature
            FROM pg_proc
            WHERE proname = func_name
            AND pronamespace = 'public'::regnamespace
        LOOP
            EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
            RAISE NOTICE '已删除函数: %', r.func_signature;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- 验证删除结果
-- ============================================================================
-- 执行后可以运行以下查询验证：
-- 
-- WITH all_functions AS (
--   SELECT 
--     n.nspname AS schema_name,
--     p.proname AS function_name
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public'
--     AND p.prokind = 'f'
-- )
-- SELECT 
--   function_name,
--   CASE 
--     WHEN function_name ~ '_1[01]\d{2}$' THEN '带后缀版本'
--     ELSE '原函数'
--   END AS function_type
-- FROM all_functions
-- WHERE function_name IN (
--   'batch_recalculate_by_filter',
--   'get_all_filtered_record_ids',
--   'get_filtered_unpaid_ids',
--   'get_finance_reconciliation_by_partner',
--   'get_invoice_request_data',
--   'get_invoice_requests_filtered',
--   'get_logistics_summary_and_records_enhanced',
--   'get_payment_request_data',
--   'get_payment_requests_filtered',
--   'get_shipper_dashboard_stats',
--   'get_subordinate_shippers_stats'
-- )
-- ORDER BY function_name;
-- ============================================================================

