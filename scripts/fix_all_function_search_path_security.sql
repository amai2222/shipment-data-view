-- 修复所有函数的search_path安全问题 - 完整版
-- 文件: scripts/fix_all_function_search_path_security.sql

-- 这个脚本会为所有函数添加 SET search_path = '' 参数来修复安全问题
-- 由于函数数量很多，我们使用动态SQL来批量修复

DO $$
DECLARE
    func_record RECORD;
    func_sql TEXT;
BEGIN
    -- 获取所有需要修复的函数
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as arguments,
            pg_get_functiondef(p.oid) as function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'  -- 只处理函数，不包括过程
        AND p.prosecdef = false  -- 排除安全定义者函数
        AND NOT EXISTS (
            SELECT 1 FROM pg_proc p2 
            WHERE p2.oid = p.oid 
            AND p2.proconfig IS NOT NULL 
            AND 'search_path=' = ANY(p2.proconfig)
        )
    LOOP
        -- 构建修复后的函数定义
        func_sql := func_record.function_definition;
        
        -- 在 LANGUAGE 后面添加 SET search_path = ''
        func_sql := regexp_replace(
            func_sql,
            '(LANGUAGE \w+)',
            '\1 SET search_path = ''''',
            'g'
        );
        
        -- 执行修复
        BEGIN
            EXECUTE func_sql;
            RAISE NOTICE 'Fixed function: %', func_record.function_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to fix function %: %', func_record.function_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 验证修复结果
SELECT 
    'Functions with search_path security fix' as status,
    COUNT(*) as total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proconfig IS NOT NULL 
AND 'search_path=' = ANY(p.proconfig);

-- 显示仍然存在问题的函数
SELECT 
    'Functions still needing fix' as status,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.prosecdef = false
AND NOT EXISTS (
    SELECT 1 FROM pg_proc p2 
    WHERE p2.oid = p.oid 
    AND p2.proconfig IS NOT NULL 
    AND 'search_path=' = ANY(p2.proconfig)
)
ORDER BY p.proname;
