-- 简单检查 permission_change_log 表是否存在
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'permission_change_log';
