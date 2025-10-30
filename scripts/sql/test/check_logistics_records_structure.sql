-- 检查 logistics_records 表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
