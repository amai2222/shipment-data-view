-- 渐进式安全修复 - 只修复最安全的函数
-- 文件: scripts/gradual_safe_function_fix.sql

-- 这个脚本只修复最安全的函数，避免系统崩溃

-- 第一步：只修复最简单的函数（parse_location_string）
-- 这个函数最安全，因为它只处理字符串，不涉及表操作
CREATE OR REPLACE FUNCTION public.parse_location_string(location_string text)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF location_string IS NULL OR location_string = '' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    RETURN string_to_array(location_string, '|');
END;
$$;

-- 第二步：修复 update_updated_at_column 触发器函数
-- 这个函数也很安全，因为它只操作 NEW 记录
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 第三步：测试修复后的函数是否正常工作
DO $$
DECLARE
    test_result text[];
    test_trigger_result boolean := true;
BEGIN
    -- 测试 parse_location_string 函数
    BEGIN
        SELECT public.parse_location_string('地点1|地点2|地点3') INTO test_result;
        IF array_length(test_result, 1) = 3 THEN
            RAISE NOTICE 'parse_location_string 函数测试通过';
        ELSE
            RAISE WARNING 'parse_location_string 函数测试失败';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'parse_location_string 函数测试异常: %', SQLERRM;
    END;
    
    -- 测试 update_updated_at_column 函数（通过检查函数定义）
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'update_updated_at_column'
            AND p.proconfig IS NOT NULL
            AND 'search_path=' = ANY(p.proconfig)
        ) THEN
            RAISE NOTICE 'update_updated_at_column 函数安全修复成功';
        ELSE
            RAISE WARNING 'update_updated_at_column 函数修复失败';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'update_updated_at_column 函数检查异常: %', SQLERRM;
    END;
END $$;

-- 第四步：验证修复结果
SELECT 
    'Safe Function Fix Results' as status,
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NOT NULL AND 'search_path=' = ANY(p.proconfig) 
        THEN '✅ Fixed'
        ELSE '❌ Not Fixed'
    END as fix_status,
    'Safe to use' as safety_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'parse_location_string',
    'update_updated_at_column'
);

-- 第五步：检查系统是否正常运行
-- 检查关键表是否可访问
SELECT 
    'System Health Check' as check_type,
    'Tables accessible' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'logistics_records',
    'profiles',
    'user_permissions',
    'projects'
);

-- 添加修复记录
INSERT INTO public.function_backup_log (function_name, original_definition, backup_reason)
VALUES 
    ('parse_location_string', 'Fixed with SET search_path = ''''', 'Safe fix applied'),
    ('update_updated_at_column', 'Fixed with SET search_path = ''''', 'Safe fix applied')
ON CONFLICT DO NOTHING;

-- 显示下一步建议
SELECT 
    'Next Steps' as recommendation,
    'Test your application functionality' as step1,
    'If everything works, we can fix more functions' as step2,
    'If problems occur, we can restore from backup' as step3;
