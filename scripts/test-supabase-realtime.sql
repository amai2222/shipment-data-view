-- Supabase实时权限功能测试脚本
-- 文件: scripts/test-supabase-realtime.sql

-- 1. 测试权限变更通知
CREATE OR REPLACE FUNCTION test_permission_notification()
RETURNS TABLE (
    test_name TEXT,
    test_result TEXT,
    test_time TIMESTAMPTZ
) AS $$
DECLARE
    test_user_id UUID;
    test_result TEXT;
BEGIN
    -- 获取一个测试用户ID
    SELECT id INTO test_user_id FROM profiles LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RETURN QUERY SELECT 
            'no_test_user' as test_name,
            '没有找到测试用户' as test_result,
            NOW() as test_time;
        RETURN;
    END IF;
    
    -- 测试权限变更通知
    BEGIN
        PERFORM pg_notify('permission_changed', json_build_object(
            'table', 'user_permissions',
            'operation', 'TEST',
            'user_id', test_user_id,
            'update_time', NOW()
        )::text);
        
        test_result := '权限变更通知测试成功';
    EXCEPTION WHEN OTHERS THEN
        test_result := '权限变更通知测试失败: ' || SQLERRM;
    END;
    
    RETURN QUERY SELECT 
        'permission_notification' as test_name,
        test_result as test_result,
        NOW() as test_time;
END;
$$ LANGUAGE plpgsql;

-- 2. 测试触发器是否存在
CREATE OR REPLACE FUNCTION test_permission_triggers()
RETURNS TABLE (
    trigger_name TEXT,
    table_name TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.trigger_name::text,
        t.event_object_table::text as table_name,
        CASE 
            WHEN t.trigger_name IS NOT NULL THEN '已创建'
            ELSE '未创建'
        END as status
    FROM information_schema.triggers t
    WHERE t.trigger_name IN (
        'user_permissions_change_trigger',
        'role_templates_change_trigger',
        'profiles_change_trigger'
    )
    ORDER BY t.trigger_name;
END;
$$ LANGUAGE plpgsql;

-- 3. 测试权限同步状态表
CREATE OR REPLACE FUNCTION test_sync_status_table()
RETURNS TABLE (
    table_name TEXT,
    record_exists BOOLEAN,
    last_sync TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pss.table_name,
        TRUE as record_exists,
        pss.last_sync
    FROM permission_sync_status pss
    ORDER BY pss.table_name;
END;
$$ LANGUAGE plpgsql;

-- 4. 测试权限监控视图
CREATE OR REPLACE FUNCTION test_permission_monitoring()
RETURNS TABLE (
    view_name TEXT,
    record_count BIGINT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'permission_realtime_status' as view_name,
        COUNT(*) as record_count,
        CASE 
            WHEN COUNT(*) > 0 THEN '正常'
            ELSE '无数据'
        END as status
    FROM permission_realtime_status;
END;
$$ LANGUAGE plpgsql;

-- 5. 综合测试函数
CREATE OR REPLACE FUNCTION run_all_realtime_tests()
RETURNS TABLE (
    test_category TEXT,
    test_name TEXT,
    test_result TEXT,
    test_time TIMESTAMPTZ
) AS $$
BEGIN
    -- 测试权限变更通知
    RETURN QUERY
    SELECT 
        'notification' as test_category,
        tpn.test_name,
        tpn.test_result,
        tpn.test_time
    FROM test_permission_notification() tpn;
    
    -- 测试触发器
    RETURN QUERY
    SELECT 
        'triggers' as test_category,
        tpt.trigger_name as test_name,
        tpt.status as test_result,
        NOW() as test_time
    FROM test_permission_triggers() tpt;
    
    -- 测试同步状态
    RETURN QUERY
    SELECT 
        'sync_status' as test_category,
        tsst.table_name as test_name,
        CASE 
            WHEN tsst.record_exists THEN '正常'
            ELSE '异常'
        END as test_result,
        tsst.last_sync as test_time
    FROM test_sync_status_table() tsst;
    
    -- 测试监控视图
    RETURN QUERY
    SELECT 
        'monitoring' as test_category,
        tpm.view_name as test_name,
        tpm.status as test_result,
        NOW() as test_time
    FROM test_permission_monitoring() tpm;
END;
$$ LANGUAGE plpgsql;

-- 执行所有测试（使用简化版本避免列名歧义）
SELECT '开始Supabase实时权限功能测试' as status;

-- 分别执行各个测试函数
SELECT '=== 权限变更通知测试 ===' as test_section;
SELECT * FROM test_permission_notification();

SELECT '=== 触发器测试 ===' as test_section;
SELECT * FROM test_permission_triggers();

SELECT '=== 同步状态测试 ===' as test_section;
SELECT * FROM test_sync_status_table();

SELECT '=== 监控视图测试 ===' as test_section;
SELECT * FROM test_permission_monitoring();

SELECT '=== 测试完成 ===' as test_section;
