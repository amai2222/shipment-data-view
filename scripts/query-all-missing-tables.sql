-- 查询所有可能遗漏的表
-- 执行这些SQL语句来发现所有相关表

-- 1. 查询所有表名（按字母顺序）
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. 查询所有包含特定关键词的表
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND (table_name LIKE '%request%' 
         OR table_name LIKE '%application%'
         OR table_name LIKE '%approval%'
         OR table_name LIKE '%work%'
         OR table_name LIKE '%wechat%'
         OR table_name LIKE '%partner%'
         OR table_name LIKE '%cost%'
         OR table_name LIKE '%chain%'
         OR table_name LIKE '%logistics%'
         OR table_name LIKE '%project%'
         OR table_name LIKE '%driver%'
         OR table_name LIKE '%location%'
         OR table_name LIKE '%billing%'
         OR table_name LIKE '%template%'
         OR table_name LIKE '%import%'
         OR table_name LIKE '%mapping%'
         OR table_name LIKE '%user%'
         OR table_name LIKE '%profile%'
         OR table_name LIKE '%role%'
         OR table_name LIKE '%permission%')
ORDER BY table_name;

-- 3. 查询所有视图
SELECT table_name as view_name
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. 查询所有函数（按类型分组）
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_type, routine_name;

-- 5. 查询所有序列
SELECT sequence_name
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 6. 查询所有触发器
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 7. 查询所有外键关系
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 8. 查询所有表的行数统计
SELECT 
    schemaname,
    relname as tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 9. 查询所有表的存储大小
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- 10. 查询所有自定义类型
SELECT 
    typname as type_name,
    typtype as type_type,
    typcategory as type_category
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND typtype IN ('c', 'e', 'd') -- composite, enum, domain
ORDER BY typname;
