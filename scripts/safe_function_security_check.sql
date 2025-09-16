-- 安全检查和修复函数search_path问题
-- 文件: scripts/safe_function_security_check.sql

-- 第一步：检查函数内部是否使用了非完全限定的表名
DO $$
DECLARE
    func_record RECORD;
    func_body TEXT;
    has_unqualified_tables BOOLEAN;
BEGIN
    RAISE NOTICE '开始检查函数安全性...';
    
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as arguments,
            pg_get_functiondef(p.oid) as function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.proname IN (
            'update_updated_at_column',
            'get_logistics_summary_and_records_enhanced',
            'parse_location_string',
            'get_logistics_summary_and_records'
        )
    LOOP
        func_body := func_record.function_definition;
        has_unqualified_tables := false;
        
        -- 检查是否包含非完全限定的表名（简单检查）
        IF func_body ~* '\bFROM\s+[a-zA-Z_][a-zA-Z0-9_]*\b' 
           AND NOT (func_body ~* '\bFROM\s+public\.[a-zA-Z_][a-zA-Z0-9_]*\b') THEN
            has_unqualified_tables := true;
        END IF;
        
        IF func_body ~* '\bJOIN\s+[a-zA-Z_][a-zA-Z0-9_]*\b' 
           AND NOT (func_body ~* '\bJOIN\s+public\.[a-zA-Z_][a-zA-Z0-9_]*\b') THEN
            has_unqualified_tables := true;
        END IF;
        
        IF has_unqualified_tables THEN
            RAISE WARNING '函数 % 可能包含非完全限定的表名，需要谨慎修复', func_record.function_name;
        ELSE
            RAISE NOTICE '函数 % 看起来安全，可以修复', func_record.function_name;
        END IF;
    END LOOP;
END $$;

-- 第二步：检查关键函数的依赖关系
SELECT 
    'Function Dependencies Check' as check_type,
    p.proname as function_name,
    COUNT(d.objid) as dependent_objects
FROM pg_proc p
LEFT JOIN pg_depend d ON p.oid = d.refobjid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_updated_at_column',
    'get_logistics_summary_and_records_enhanced',
    'parse_location_string',
    'get_logistics_summary_and_records'
)
GROUP BY p.proname, p.oid
ORDER BY dependent_objects DESC;

-- 第三步：检查触发器依赖
SELECT 
    'Trigger Dependencies' as check_type,
    t.tgname as trigger_name,
    p.proname as function_name,
    c.relname as table_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_updated_at_column',
    'get_logistics_summary_and_records_enhanced',
    'parse_location_string',
    'get_logistics_summary_and_records'
);

-- 第四步：创建备份表（记录当前函数状态）
CREATE TABLE IF NOT EXISTS public.function_backup_log (
    id SERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    backup_time TIMESTAMP DEFAULT NOW(),
    original_definition TEXT,
    backup_reason TEXT DEFAULT 'Security fix backup'
);

-- 备份关键函数定义
INSERT INTO public.function_backup_log (function_name, original_definition)
SELECT 
    p.proname,
    pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_updated_at_column',
    'get_logistics_summary_and_records_enhanced',
    'parse_location_string',
    'get_logistics_summary_and_records'
)
ON CONFLICT DO NOTHING;

-- 显示检查结果摘要
SELECT 
    'Security Check Summary' as summary,
    'Functions to check: 4' as functions_count,
    'Backup created: Yes' as backup_status,
    'Ready for safe testing' as next_step;
