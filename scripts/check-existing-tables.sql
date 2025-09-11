-- 检查现有表结构，特别是用户和角色相关的表
-- 这个脚本会帮助我们了解现有的表结构

-- 检查所有表
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 检查用户相关的表结构
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'users', 'user_roles', 'roles', 'departments')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 检查是否有 roles 表
SELECT 
  'roles' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'user_roles' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles' AND table_schema = 'public') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'profiles' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'departments' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments' AND table_schema = 'public') 
       THEN 'EXISTS' ELSE 'MISSING' END as status;
