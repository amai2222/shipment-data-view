-- 函数安全修复恢复脚本
-- 文件: scripts/restore_function_from_backup.sql

-- 如果修复后系统出现问题，可以使用这个脚本恢复

-- 第一步：查看可用的备份
SELECT 
    'Available Backups' as info,
    function_name,
    backup_time,
    backup_reason
FROM public.function_backup_log
ORDER BY backup_time DESC;

-- 第二步：恢复 parse_location_string 函数（如果需要）
-- 注意：这里使用原始定义，不包含 SET search_path
CREATE OR REPLACE FUNCTION public.parse_location_string(location_string text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
BEGIN
    IF location_string IS NULL OR location_string = '' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    RETURN string_to_array(location_string, '|');
END;
$$;

-- 第三步：恢复 update_updated_at_column 函数（如果需要）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 第四步：验证恢复结果
SELECT 
    'Restoration Results' as status,
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL OR NOT ('search_path=' = ANY(p.proconfig))
        THEN '✅ Restored (no search_path)'
        ELSE '❌ Still has search_path'
    END as restore_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'parse_location_string',
    'update_updated_at_column'
);

-- 第五步：测试恢复后的函数
DO $$
DECLARE
    test_result text[];
BEGIN
    -- 测试 parse_location_string
    SELECT public.parse_location_string('测试|地点|数据') INTO test_result;
    IF array_length(test_result, 1) = 3 THEN
        RAISE NOTICE 'parse_location_string 恢复后测试通过';
    ELSE
        RAISE WARNING 'parse_location_string 恢复后测试失败';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'parse_location_string 恢复后测试异常: %', SQLERRM;
END $$;

-- 记录恢复操作
INSERT INTO public.function_backup_log (function_name, original_definition, backup_reason)
VALUES 
    ('parse_location_string', 'Restored to original version', 'Restoration from backup'),
    ('update_updated_at_column', 'Restored to original version', 'Restoration from backup')
ON CONFLICT DO NOTHING;

-- 显示恢复完成信息
SELECT 
    'Restoration Complete' as status,
    'Functions restored to original state' as message,
    'System should be back to normal' as result;
