-- 检查locations表的实际结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;