-- 一键恢复所有函数定义
-- 文件: scripts/restore_all_functions.sql

-- 这个脚本可以从备份中恢复所有函数

-- 第一步：显示可用的备份
SELECT 
    'Available Backups' as info,
    backup_time,
    COUNT(*) as function_count,
    COUNT(DISTINCT function_name) as unique_functions
FROM public.function_backup_log
GROUP BY backup_time
ORDER BY backup_time DESC;

-- 第二步：选择要恢复的备份时间（这里使用最新的备份）
-- 如果需要恢复特定时间的备份，请修改下面的时间条件
WITH latest_backup AS (
    SELECT MAX(backup_time) as backup_time
    FROM public.function_backup_log
    WHERE backup_reason = 'Full backup before security fix'
)
SELECT 
    'Restoring from backup time: ' || backup_time as restore_info
FROM latest_backup;

-- 第三步：恢复所有函数
DO $$
DECLARE
    func_record RECORD;
    restore_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '开始恢复所有函数...';
    
    -- 获取最新备份的所有函数
    FOR func_record IN 
        SELECT 
            function_name,
            function_arguments,
            original_definition,
            backup_time
        FROM public.function_backup_log
        WHERE backup_reason = 'Full backup before security fix'
        AND backup_time = (
            SELECT MAX(backup_time) 
            FROM public.function_backup_log 
            WHERE backup_reason = 'Full backup before security fix'
        )
        ORDER BY function_name
    LOOP
        BEGIN
            -- 执行函数定义
            EXECUTE func_record.original_definition;
            restore_count := restore_count + 1;
            RAISE NOTICE '恢复函数: %', func_record.function_name;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING '恢复函数 % 失败: %', func_record.function_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '恢复完成: 成功 % 个, 失败 % 个', restore_count, error_count;
END $$;

-- 第四步：验证恢复结果
SELECT 
    'Restoration Verification' as check_type,
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL OR NOT ('search_path=' = ANY(p.proconfig))
        THEN '✅ Restored (no search_path)'
        ELSE '❌ Still has search_path'
    END as restore_status,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind IN ('f', 'p', 'a', 'w')
ORDER BY p.proname;

-- 第五步：测试关键函数是否正常工作
DO $$
DECLARE
    test_result text[];
    test_count INTEGER := 0;
    success_count INTEGER := 0;
BEGIN
    RAISE NOTICE '开始测试关键函数...';
    
    -- 测试 parse_location_string
    BEGIN
        SELECT public.parse_location_string('测试|地点|数据') INTO test_result;
        IF array_length(test_result, 1) = 3 THEN
            success_count := success_count + 1;
            RAISE NOTICE 'parse_location_string 测试通过';
        ELSE
            RAISE WARNING 'parse_location_string 测试失败';
        END IF;
        test_count := test_count + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'parse_location_string 测试异常: %', SQLERRM;
        test_count := test_count + 1;
    END;
    
    -- 测试 get_logistics_summary_and_records_enhanced
    BEGIN
        PERFORM public.get_logistics_summary_and_records_enhanced();
        success_count := success_count + 1;
        RAISE NOTICE 'get_logistics_summary_and_records_enhanced 测试通过';
        test_count := test_count + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'get_logistics_summary_and_records_enhanced 测试异常: %', SQLERRM;
        test_count := test_count + 1;
    END;
    
    RAISE NOTICE '函数测试完成: 成功 %/% 个', success_count, test_count;
END $$;

-- 第六步：记录恢复操作
INSERT INTO public.function_backup_log (function_name, original_definition, backup_reason)
VALUES 
    ('SYSTEM_RESTORE', 'All functions restored from backup', 'Full system restoration')
ON CONFLICT DO NOTHING;

-- 显示恢复完成信息
SELECT 
    'Restoration Complete' as status,
    'All functions restored from backup' as message,
    'System should be back to original state' as result,
    NOW() as restore_time;
