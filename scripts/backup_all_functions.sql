-- 一键备份所有函数定义
-- 文件: scripts/backup_all_functions.sql

-- 创建备份表（如果不存在）
CREATE TABLE IF NOT EXISTS public.function_backup_log (
    id SERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    function_arguments TEXT,
    backup_time TIMESTAMP DEFAULT NOW(),
    original_definition TEXT,
    backup_reason TEXT DEFAULT 'Full backup before security fix',
    function_type TEXT DEFAULT 'function',
    schema_name TEXT DEFAULT 'public'
);

-- 清空之前的备份记录（可选）
-- DELETE FROM public.function_backup_log WHERE backup_reason = 'Full backup before security fix';

-- 备份所有public schema的函数
INSERT INTO public.function_backup_log (
    function_name, 
    function_arguments, 
    original_definition, 
    backup_reason,
    function_type,
    schema_name
)
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as function_arguments,
    pg_get_functiondef(p.oid) as original_definition,
    'Full backup before security fix' as backup_reason,
    CASE 
        WHEN p.prokind = 'f' THEN 'function'
        WHEN p.prokind = 'p' THEN 'procedure'
        WHEN p.prokind = 'a' THEN 'aggregate'
        WHEN p.prokind = 'w' THEN 'window'
        ELSE 'other'
    END as function_type,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind IN ('f', 'p', 'a', 'w')  -- 备份函数、过程、聚合函数、窗口函数
ORDER BY p.proname;

-- 显示备份结果统计
SELECT 
    'Backup Summary' as info,
    COUNT(*) as total_functions_backed_up,
    COUNT(DISTINCT function_name) as unique_functions,
    MIN(backup_time) as backup_start_time,
    MAX(backup_time) as backup_end_time
FROM public.function_backup_log
WHERE backup_reason = 'Full backup before security fix';

-- 显示备份的函数列表
SELECT 
    'Backed Up Functions' as category,
    function_name,
    function_arguments,
    function_type,
    LENGTH(original_definition) as definition_length
FROM public.function_backup_log
WHERE backup_reason = 'Full backup before security fix'
ORDER BY function_name;

-- 检查是否有重复备份
SELECT 
    'Duplicate Check' as check_type,
    function_name,
    COUNT(*) as backup_count
FROM public.function_backup_log
WHERE backup_reason = 'Full backup before security fix'
GROUP BY function_name
HAVING COUNT(*) > 1
ORDER BY backup_count DESC;

-- 显示备份完成信息
SELECT 
    'Backup Complete' as status,
    'All functions backed up successfully' as message,
    'You can now safely proceed with security fixes' as next_step;
