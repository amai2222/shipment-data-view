-- 最基础的数据库信息查询（避免超时）
-- 请逐个执行这些查询

-- 查询1: 所有表名
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 查询2: 所有函数名
SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' ORDER BY proname;

-- 查询3: profiles表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' ORDER BY ordinal_position;

-- 查询4: logistics_records表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logistics_records' ORDER BY ordinal_position;

-- 查询5: projects表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' ORDER BY ordinal_position;

-- 查询6: 检查导入模板表是否存在
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%import%';
