-- 简化的Supabase实时权限功能测试脚本
-- 文件: scripts/simple-supabase-realtime-test.sql

-- 1. 检查触发器是否存在
SELECT 
    '触发器检查' as test_category,
    trigger_name::text as test_name,
    event_object_table::text as table_name,
    '已创建' as test_result,
    NOW() as test_time
FROM information_schema.triggers 
WHERE trigger_name IN (
    'user_permissions_change_trigger',
    'role_templates_change_trigger',
    'profiles_change_trigger'
)
ORDER BY trigger_name;

-- 2. 检查权限同步状态表
SELECT 
    '同步状态检查' as test_category,
    table_name as test_name,
    '记录存在' as test_result,
    last_sync as test_time
FROM permission_sync_status
ORDER BY table_name;

-- 3. 检查权限监控视图
SELECT 
    '监控视图检查' as test_category,
    table_name as test_name,
    CASE 
        WHEN total_records > 0 THEN '有数据'
        ELSE '无数据'
    END as test_result,
    NOW() as test_time
FROM permission_realtime_status
ORDER BY table_name;

-- 4. 测试权限变更通知功能
DO $$
DECLARE
    test_user_id UUID;
    notification_result TEXT;
BEGIN
    -- 获取一个测试用户ID
    SELECT id INTO test_user_id FROM profiles LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- 测试权限变更通知
        BEGIN
            PERFORM pg_notify('permission_changed', json_build_object(
                'table', 'user_permissions',
                'operation', 'TEST',
                'user_id', test_user_id,
                'update_time', NOW()
            )::text);
            
            notification_result := '权限变更通知测试成功';
        EXCEPTION WHEN OTHERS THEN
            notification_result := '权限变更通知测试失败: ' || SQLERRM;
        END;
        
        -- 输出测试结果
        RAISE NOTICE '通知功能测试: %', notification_result;
    ELSE
        RAISE NOTICE '通知功能测试: 没有找到测试用户';
    END IF;
END $$;

-- 5. 检查权限统计函数
SELECT 
    '统计函数检查' as test_category,
    'get_permission_stats' as test_name,
    '函数存在' as test_result,
    NOW() as test_time
WHERE EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'get_permission_stats'
);

-- 6. 检查权限监控函数
SELECT 
    '监控函数检查' as test_category,
    'monitor_permission_realtime' as test_name,
    '函数存在' as test_result,
    NOW() as test_time
WHERE EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'monitor_permission_realtime'
);

-- 7. 执行权限统计
SELECT 
    '权限统计' as test_category,
    'current_stats' as test_name,
    '统计完成' as test_result,
    NOW() as test_time
UNION ALL
SELECT 
    '权限统计' as test_category,
    'total_users' as test_name,
    total_users::text as test_result,
    NOW() as test_time
FROM get_permission_stats()
UNION ALL
SELECT 
    '权限统计' as test_category,
    'active_users' as test_name,
    active_users::text as test_result,
    NOW() as test_time
FROM get_permission_stats()
UNION ALL
SELECT 
    '权限统计' as test_category,
    'total_role_templates' as test_name,
    total_role_templates::text as test_result,
    NOW() as test_time
FROM get_permission_stats()
UNION ALL
SELECT 
    '权限统计' as test_category,
    'total_user_permissions' as test_name,
    total_user_permissions::text as test_result,
    NOW() as test_time
FROM get_permission_stats();

-- 8. 执行权限监控
SELECT 
    '权限监控' as test_category,
    status as test_name,
    message as test_result,
    update_time as test_time
FROM monitor_permission_realtime();

-- 完成测试
SELECT 'Supabase实时权限功能测试完成' as status;
