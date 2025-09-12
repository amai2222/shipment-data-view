-- 简化的数据库结构查询命令（避免超时）
-- 请在Supabase SQL编辑器中逐个执行

-- 1. 获取所有表名（最简单）
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 获取所有函数名（简化版）
SELECT proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- 3. 获取所有视图名
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;

-- 4. 获取关键表的字段信息（只查询最重要的表）
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN ('profiles', 'projects', 'logistics_records')
ORDER BY t.table_name, c.ordinal_position;

-- 5. 获取profiles表的详细信息
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 6. 获取logistics_records表的详细信息
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'logistics_records'
ORDER BY ordinal_position;

-- 7. 获取projects表的详细信息
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'projects'
ORDER BY ordinal_position;

-- 8. 检查是否有导入模板相关表
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename LIKE '%import%'
ORDER BY tablename;

-- 9. 获取主键信息（只查询关键表）
SELECT 
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_name IN ('profiles', 'projects', 'logistics_records')
ORDER BY tc.table_name;

-- 10. 获取外键信息（只查询关键表）
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('profiles', 'projects', 'logistics_records')
ORDER BY tc.table_name;
