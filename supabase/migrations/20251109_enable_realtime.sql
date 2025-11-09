-- ============================================================================
-- 启用 Realtime 实时订阅
-- 创建时间: 2025-11-09
-- 功能: 为费用申请和派单表启用实时订阅，支持数据自动更新
-- ============================================================================

-- 启用费用申请表的 Realtime（如果还没启用）
DO $$
BEGIN
    -- 尝试添加表到 publication
    ALTER PUBLICATION supabase_realtime ADD TABLE internal_driver_expense_applications;
    RAISE NOTICE '✅ internal_driver_expense_applications 已添加到 Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  internal_driver_expense_applications 已在 Realtime 中';
END $$;

-- 启用派单表的 Realtime
DO $$
BEGIN
    -- 尝试添加表到 publication
    ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_orders;
    RAISE NOTICE '✅ dispatch_orders 已添加到 Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  dispatch_orders 已在 Realtime 中';
    WHEN undefined_table THEN
        RAISE NOTICE '❌ dispatch_orders 表不存在，请先执行派单系统创建脚本';
END $$;

-- ============================================================================
-- 验证 Realtime 配置
-- ============================================================================

-- 查看所有启用了 Realtime 的表
SELECT 
    schemaname,
    tablename,
    'Realtime已启用' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Realtime 配置完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已启用的表：';
    RAISE NOTICE '  - internal_driver_expense_applications';
    RAISE NOTICE '  - dispatch_orders';
    RAISE NOTICE '';
    RAISE NOTICE '📱 司机端现在可以：';
    RAISE NOTICE '  ✓ 实时接收费用审核结果';
    RAISE NOTICE '  ✓ 实时接收新派单通知';
    RAISE NOTICE '  ✓ 自动刷新数据列表';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

