-- ============================================================================
-- 启用 notifications 表的 Realtime 实时订阅
-- 创建时间: 2025-11-25
-- 功能: 确保 notifications 表已启用 Realtime，支持实时推送通知
-- ============================================================================

BEGIN;

-- 启用 notifications 表的 Realtime（如果还没启用）
DO $$
BEGIN
    -- 尝试添加表到 publication
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    RAISE NOTICE '✅ notifications 已添加到 Realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  notifications 已在 Realtime 中';
    WHEN undefined_table THEN
        RAISE NOTICE '❌ notifications 表不存在';
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
AND tablename IN ('notifications', 'dispatch_orders', 'internal_driver_expense_applications')
ORDER BY tablename;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ notifications 表 Realtime 配置完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📱 现在可以实时接收通知了：';
    RAISE NOTICE '  ✓ 派单通知';
    RAISE NOTICE '  ✓ 费用审批通知';
    RAISE NOTICE '  ✓ 付款审批通知';
    RAISE NOTICE '  ✓ 其他系统通知';
    RAISE NOTICE '';
    RAISE NOTICE '💡 前端订阅系统会自动接收并显示通知';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

