-- 查看函数备份状态
-- 文件: scripts/check_backup_status.sql

-- 显示所有备份记录
SELECT 
    'All Backup Records' as info,
    id,
    function_name,
    function_arguments,
    backup_time,
    backup_reason,
    function_type,
    LENGTH(original_definition) as definition_length
FROM public.function_backup_log
ORDER BY backup_time DESC, function_name;

-- 显示备份统计信息
SELECT 
    'Backup Statistics' as category,
    backup_reason,
    COUNT(*) as function_count,
    COUNT(DISTINCT function_name) as unique_functions,
    MIN(backup_time) as earliest_backup,
    MAX(backup_time) as latest_backup
FROM public.function_backup_log
GROUP BY backup_reason
ORDER BY latest_backup DESC;

-- 显示当前数据库中的函数状态
SELECT 
    'Current Function Status' as info,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.proconfig IS NULL THEN 'No security config'
        WHEN 'search_path=' = ANY(p.proconfig) THEN 'Has search_path security'
        ELSE 'Other config'
    END as security_status,
    CASE 
        WHEN p.prokind = 'f' THEN 'function'
        WHEN p.prokind = 'p' THEN 'procedure'
        WHEN p.prokind = 'a' THEN 'aggregate'
        WHEN p.prokind = 'w' THEN 'window'
        ELSE 'other'
    END as function_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind IN ('f', 'p', 'a', 'w')
ORDER BY p.proname;

-- 显示需要安全修复的函数
SELECT 
    'Functions Needing Security Fix' as info,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    'Missing search_path security' as issue
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

-- 显示备份表大小信息
SELECT 
    'Backup Table Info' as info,
    pg_size_pretty(pg_total_relation_size('public.function_backup_log')) as table_size,
    COUNT(*) as total_records,
    COUNT(DISTINCT function_name) as unique_functions
FROM public.function_backup_log;
