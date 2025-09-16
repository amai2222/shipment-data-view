-- 导出备份为SQL文件
-- 文件: scripts/export_backup_to_file.sql

-- 这个脚本可以将备份导出为SQL文件，更安全

-- 第一步：创建导出目录（如果不存在）
-- 注意：这个目录需要在Supabase服务器上存在
-- 或者使用客户端工具导出

-- 第二步：导出备份表结构
COPY (
    SELECT 
        'CREATE TABLE IF NOT EXISTS public.function_backup_log (' ||
        'id SERIAL PRIMARY KEY, ' ||
        'function_name TEXT NOT NULL, ' ||
        'function_arguments TEXT, ' ||
        'backup_time TIMESTAMP DEFAULT NOW(), ' ||
        'original_definition TEXT, ' ||
        'backup_reason TEXT DEFAULT ''Full backup before security fix'', ' ||
        'function_type TEXT DEFAULT ''function'', ' ||
        'schema_name TEXT DEFAULT ''public'');' as sql_statement
) TO '/tmp/backup_table_structure.sql';

-- 第三步：导出备份数据
COPY public.function_backup_log TO '/tmp/function_backup_data.csv' 
WITH (FORMAT csv, HEADER true);

-- 第四步：生成恢复脚本
COPY (
    SELECT 
        'INSERT INTO public.function_backup_log (function_name, function_arguments, backup_time, original_definition, backup_reason, function_type, schema_name) VALUES (' ||
        '''' || function_name || ''', ' ||
        COALESCE('''' || function_arguments || '''', 'NULL') || ', ' ||
        '''' || backup_time || ''', ' ||
        '''' || REPLACE(original_definition, '''', '''''') || ''', ' ||
        '''' || backup_reason || ''', ' ||
        '''' || function_type || ''', ' ||
        '''' || schema_name || ''');' as sql_statement
    FROM public.function_backup_log
    ORDER BY backup_time DESC
) TO '/tmp/restore_backup.sql';

-- 显示导出信息
SELECT 
    'Export Complete' as status,
    'Backup exported to /tmp/' as location,
    'Files: backup_table_structure.sql, function_backup_data.csv, restore_backup.sql' as files;
