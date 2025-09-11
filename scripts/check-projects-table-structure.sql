-- 检查 projects 表的当前结构
-- 这个脚本会显示 projects 表的所有列和数据类型

-- 1. 查看 projects 表的所有列
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查是否存在 effective_quantity_type 字段
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'projects' 
              AND column_name = 'effective_quantity_type'
              AND table_schema = 'public'
        ) 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as effective_quantity_type_status;

-- 3. 检查枚举类型是否存在
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_type 
            WHERE typname = 'effective_quantity_type'
        ) 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END as enum_type_status;

-- 4. 如果字段存在，显示其当前值
SELECT 
    id,
    name,
    effective_quantity_type
FROM public.projects 
LIMIT 5;
