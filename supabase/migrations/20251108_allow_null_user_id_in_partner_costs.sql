-- ============================================================================
-- 允许logistics_partner_costs表的user_id为NULL
-- 创建日期：2025-11-08
-- 原因：批量重算和触发器重算时，auth.uid()可能为NULL
-- ============================================================================

-- 修改user_id字段允许为空
ALTER TABLE logistics_partner_costs
ALTER COLUMN user_id DROP NOT NULL;

-- 验证
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ user_id字段已允许为NULL';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修改：';
    RAISE NOTICE '  • logistics_partner_costs.user_id 允许NULL';
    RAISE NOTICE '';
    RAISE NOTICE '原因：';
    RAISE NOTICE '  • 批量重算时auth.uid()可能为NULL';
    RAISE NOTICE '  • 触发器重算时auth.uid()可能为NULL';
    RAISE NOTICE '';
    RAISE NOTICE '现在一键重算应该能正常执行了！';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

