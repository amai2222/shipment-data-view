-- 检查logistics_records表结构
-- 文件路径: scripts/check-logistics-records-structure.sql
-- 描述: 检查logistics_records表的实际结构

-- 1. 检查logistics_records表的所有字段
SELECT 'logistics_records表字段:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查是否有created_at字段
SELECT '检查created_at字段:' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND table_schema = 'public'
  AND column_name LIKE '%created%';

-- 3. 检查是否有时间戳相关字段
SELECT '检查时间戳字段:' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND table_schema = 'public'
  AND (data_type LIKE '%timestamp%' OR data_type LIKE '%date%' OR column_name LIKE '%time%');
