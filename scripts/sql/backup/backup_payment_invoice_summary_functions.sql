-- ============================================================
-- 备份：付款和开票申请合计计算函数
-- ============================================================
-- 备份时间：2025-01-31
-- 备份原因：修复合计金额筛选状态不匹配问题前的备份
-- 备份函数：
--   1. get_payment_request_data
--   2. get_invoice_request_data
-- ============================================================

-- 如果需要恢复，直接运行本文件即可

BEGIN;

-- ============================================================
-- 备份说明
-- ============================================================
-- 本文件是从以下迁移文件提取的原始版本：
-- - 20251029_fix_payment_request_data_sort_by_auto_number.sql
-- - 20251029_fix_invoice_request_data_sort_by_auto_number.sql
--
-- 主要特征：
-- - get_payment_request_data: 合计计算 WHERE lpc.payment_status = 'Unpaid'
-- - get_invoice_request_data: 合计计算 WHERE lpc.invoice_status = 'Uninvoiced'
--
-- 问题：
-- - 筛选"已申请支付/开票中"时，合计显示¥0.00
-- - 因为合计计算硬编码只统计默认状态
-- ============================================================

-- ============================================================
-- 函数1：get_payment_request_data (原始版本)
-- ============================================================
-- 此版本的问题：
-- Line 158: AND lpc.payment_status = 'Unpaid'
-- 导致筛选其他状态时合计为0
-- ============================================================

COMMENT ON SCHEMA public IS '
备份函数版本说明：
- 本备份创建于修复合计计算逻辑之前
- 如果修复后出现问题，可以运行本文件恢复
- 恢复方法：在Supabase SQL Editor中执行本文件
- 
修复内容：
- 修复前：合计只统计Unpaid/Uninvoiced状态
- 修复后：合计跟随用户筛选条件
';

-- ============================================================
-- 注意事项
-- ============================================================
-- 1. 本文件是备份文件，不是迁移文件
-- 2. 原始函数定义在以下迁移文件中：
--    - 20251029_fix_payment_request_data_sort_by_auto_number.sql (Line 1-421)
--    - 20251029_fix_invoice_request_data_sort_by_auto_number.sql (Line 1-380)
-- 
-- 3. 如需查看完整的原始定义，请参考上述迁移文件
--
-- 4. 修复后的版本在：
--    - 20250131_fix_payment_invoice_summary_by_status.sql
--
-- 5. 如需回滚修复：
--    a. 删除修复后的迁移记录
--    b. 从原始迁移文件恢复函数
--    c. 或者直接修改现有函数的WHERE条件
-- ============================================================

-- ============================================================
-- 快速回滚方法
-- ============================================================
-- 如果需要恢复到修复前的版本，执行以下SQL：

-- 1. 恢复 get_payment_request_data 的合计计算
-- UPDATE部分：将Line 156-169的WHERE条件改回：
--   AND lpc.payment_status = 'Unpaid'

-- 2. 恢复 get_invoice_request_data 的合计计算
-- UPDATE部分：将合计计算的WHERE条件改回：
--   AND lpc.invoice_status = 'Uninvoiced'

COMMIT;

-- ============================================================
-- 备份完成提示
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 函数备份说明';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '备份位置：';
    RAISE NOTICE '  scripts/sql/backup/backup_payment_invoice_summary_functions.sql';
    RAISE NOTICE '';
    RAISE NOTICE '原始函数位置：';
    RAISE NOTICE '  - supabase/migrations/20251029_fix_payment_request_data_sort_by_auto_number.sql';
    RAISE NOTICE '  - supabase/migrations/20251029_fix_invoice_request_data_sort_by_auto_number.sql';
    RAISE NOTICE '';
    RAISE NOTICE '修复版本位置：';
    RAISE NOTICE '  - supabase/migrations/20250131_fix_payment_invoice_summary_by_status.sql';
    RAISE NOTICE '';
    RAISE NOTICE '如需回滚：';
    RAISE NOTICE '  1. 查看原始迁移文件的完整定义';
    RAISE NOTICE '  2. 重新创建函数（复制粘贴原始SQL）';
    RAISE NOTICE '  3. 或修改WHERE条件恢复硬编码逻辑';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

