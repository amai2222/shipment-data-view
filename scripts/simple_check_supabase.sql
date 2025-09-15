-- 最简单的 Supabase 检查脚本
-- 只检查真正重要的对象

-- 1. 检查函数
SELECT 'Functions' as category, routine_name, 'FOUND' as status
FROM information_schema.routines 
WHERE routine_definition LIKE '%permission_change_log%' AND routine_schema = 'public'
UNION ALL
SELECT 'Functions', routine_name, 'NOT FOUND'
FROM information_schema.routines 
WHERE routine_definition NOT LIKE '%permission_change_log%' AND routine_schema = 'public'
ORDER BY routine_name;

-- 2. 检查触发器
SELECT 'Triggers' as category, trigger_name, 'FOUND' as status
FROM information_schema.triggers 
WHERE action_statement LIKE '%permission_change_log%' AND trigger_schema = 'public'
UNION ALL
SELECT 'Triggers', trigger_name, 'NOT FOUND'
FROM information_schema.triggers 
WHERE action_statement NOT LIKE '%permission_change_log%' AND trigger_schema = 'public'
ORDER BY trigger_name;

-- 3. 检查视图
SELECT 'Views' as category, table_name, 'FOUND' as status
FROM information_schema.views 
WHERE view_definition LIKE '%permission_change_log%' AND table_schema = 'public'
UNION ALL
SELECT 'Views', table_name, 'NOT FOUND'
FROM information_schema.views 
WHERE view_definition NOT LIKE '%permission_change_log%' AND table_schema = 'public'
ORDER BY table_name;

-- 4. 检查表
SELECT 'Tables' as category, table_name, 'FOUND' as status
FROM information_schema.tables 
WHERE table_name LIKE '%permission_change_log%' AND table_schema = 'public'
UNION ALL
SELECT 'Tables', table_name, 'NOT FOUND'
FROM information_schema.tables 
WHERE table_name NOT LIKE '%permission_change_log%' AND table_schema = 'public'
ORDER BY table_name;

-- 5. 检查索引
SELECT 'Indexes' as category, indexname, 'FOUND' as status
FROM pg_indexes 
WHERE indexdef LIKE '%permission_change_log%' AND schemaname = 'public'
UNION ALL
SELECT 'Indexes', indexname, 'NOT FOUND'
FROM pg_indexes 
WHERE indexdef NOT LIKE '%permission_change_log%' AND schemaname = 'public'
ORDER BY indexname;

-- 6. 检查 RLS 策略
SELECT 'RLS Policies' as category, policyname, 'FOUND' as status
FROM pg_policies 
WHERE qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%'
UNION ALL
SELECT 'RLS Policies', policyname, 'NOT FOUND'
FROM pg_policies 
WHERE qual NOT LIKE '%permission_change_log%' AND with_check NOT LIKE '%permission_change_log%'
ORDER BY policyname;

-- 7. 检查扩展函数
SELECT 'Extension Functions' as category, proname, 'FOUND' as status
FROM pg_proc 
WHERE prosrc LIKE '%permission_change_log%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT 'Extension Functions', proname, 'NOT FOUND'
FROM pg_proc 
WHERE prosrc NOT LIKE '%permission_change_log%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 8. 最终汇总 - 只显示找到引用的对象
SELECT 'FINAL RESULT' as category, 'Objects with permission_change_log references' as description, COUNT(*) as count
FROM (
  SELECT routine_name FROM information_schema.routines WHERE routine_definition LIKE '%permission_change_log%' AND routine_schema = 'public'
  UNION ALL
  SELECT trigger_name FROM information_schema.triggers WHERE action_statement LIKE '%permission_change_log%' AND trigger_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.views WHERE view_definition LIKE '%permission_change_log%' AND table_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%permission_change_log%' AND table_schema = 'public'
  UNION ALL
  SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%permission_change_log%' AND schemaname = 'public'
  UNION ALL
  SELECT policyname FROM pg_policies WHERE qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%'
  UNION ALL
  SELECT proname FROM pg_proc WHERE prosrc LIKE '%permission_change_log%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
) as all_refs;
