-- 检查 Supabase 中所有可能引用 permission_change_log 表的对象
-- 包括函数、触发器、视图、Edge Functions 等

-- 1. 检查所有函数定义中是否包含 permission_change_log
SELECT 
  'Function' as object_type,
  routine_name as object_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%permission_change_log%'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- 2. 检查所有视图定义中是否包含 permission_change_log
SELECT 
  'View' as object_type,
  table_name as object_name,
  view_definition
FROM information_schema.views 
WHERE view_definition LIKE '%permission_change_log%'
  AND table_schema = 'public'
ORDER BY table_name;

-- 3. 检查所有触发器定义中是否包含 permission_change_log
SELECT 
  'Trigger' as object_type,
  trigger_name as object_name,
  event_object_table as table_name,
  event_manipulation as event_type,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%permission_change_log%'
  AND trigger_schema = 'public'
ORDER BY trigger_name;

-- 4. 检查所有约束定义中是否包含 permission_change_log
SELECT 
  'Constraint' as object_type,
  constraint_name as object_name,
  table_name,
  constraint_type,
  'N/A' as check_clause
FROM information_schema.table_constraints 
WHERE constraint_name LIKE '%permission_change_log%'
  AND table_schema = 'public'
ORDER BY constraint_name;

-- 5. 检查所有索引定义中是否包含 permission_change_log
SELECT 
  'Index' as object_type,
  indexname as object_name,
  tablename as table_name,
  indexdef as definition
FROM pg_indexes 
WHERE indexdef LIKE '%permission_change_log%'
  AND schemaname = 'public'
ORDER BY indexname;

-- 6. 检查所有序列定义中是否包含 permission_change_log
SELECT 
  'Sequence' as object_type,
  sequence_name as object_name,
  data_type,
  start_value,
  minimum_value,
  maximum_value
FROM information_schema.sequences 
WHERE sequence_name LIKE '%permission_change_log%'
  AND sequence_schema = 'public'
ORDER BY sequence_name;

-- 7. 检查所有表定义中是否包含 permission_change_log
SELECT 
  'Table' as object_type,
  table_name as object_name,
  table_type
FROM information_schema.tables 
WHERE table_name LIKE '%permission_change_log%'
  AND table_schema = 'public'
ORDER BY table_name;

-- 8. 检查所有列定义中是否包含 permission_change_log
SELECT 
  'Column' as object_type,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE column_name LIKE '%permission_change_log%'
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 9. 检查所有 RLS 策略中是否包含 permission_change_log
SELECT 
  'RLS Policy' as object_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE qual LIKE '%permission_change_log%'
  OR with_check LIKE '%permission_change_log%'
ORDER BY tablename, policyname;

-- 10. 检查所有扩展函数中是否包含 permission_change_log
SELECT 
  'Extension Function' as object_type,
  proname as function_name,
  proargnames as argument_names,
  prosrc as function_source
FROM pg_proc 
WHERE prosrc LIKE '%permission_change_log%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 11. 汇总统计
SELECT 
  'Summary' as category,
  COUNT(*) as total_objects,
  'objects referencing permission_change_log' as description
FROM (
  SELECT routine_name FROM information_schema.routines WHERE routine_definition LIKE '%permission_change_log%' AND routine_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.views WHERE view_definition LIKE '%permission_change_log%' AND table_schema = 'public'
  UNION ALL
  SELECT trigger_name FROM information_schema.triggers WHERE action_statement LIKE '%permission_change_log%' AND trigger_schema = 'public'
  UNION ALL
  SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_name LIKE '%permission_change_log%' AND table_schema = 'public'
  UNION ALL
  SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%permission_change_log%' AND schemaname = 'public'
  UNION ALL
  SELECT sequence_name FROM information_schema.sequences WHERE sequence_name LIKE '%permission_change_log%' AND sequence_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%permission_change_log%' AND table_schema = 'public'
) as all_refs;
