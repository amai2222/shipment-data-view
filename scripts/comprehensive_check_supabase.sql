-- 检查 Supabase Edge Functions 和所有数据库对象
-- 专门查找 permission_change_log 的引用

-- 1. 检查所有函数定义
SELECT 
  'Function Definitions' as category,
  routine_name,
  routine_type,
  CASE 
    WHEN routine_definition LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 2. 检查所有触发器
SELECT 
  'Trigger Definitions' as category,
  trigger_name,
  event_object_table,
  CASE 
    WHEN action_statement LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- 3. 检查所有视图
SELECT 
  'View Definitions' as category,
  table_name,
  CASE 
    WHEN view_definition LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. 检查所有表
SELECT 
  'Table Definitions' as category,
  table_name,
  table_type,
  CASE 
    WHEN table_name LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 5. 检查所有索引
SELECT 
  'Index Definitions' as category,
  indexname,
  tablename,
  CASE 
    WHEN indexdef LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY indexname;

-- 6. 检查所有序列
SELECT 
  'Sequence Definitions' as category,
  sequence_name,
  CASE 
    WHEN sequence_name LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 7. 检查所有列
SELECT 
  'Column Definitions' as category,
  table_name,
  column_name,
  CASE 
    WHEN column_name LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, column_name;

-- 8. 检查所有 RLS 策略
SELECT 
  'RLS Policy Definitions' as category,
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM pg_policies 
ORDER BY tablename, policyname;

-- 9. 检查所有扩展函数
SELECT 
  'Extension Function Definitions' as category,
  proname,
  CASE 
    WHEN prosrc LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 10. 检查所有约束
SELECT 
  'Constraint Definitions' as category,
  constraint_name,
  table_name,
  constraint_type,
  CASE 
    WHEN constraint_name LIKE '%permission_change_log%' OR check_clause LIKE '%permission_change_log%' THEN 'FOUND REFERENCE'
    ELSE 'NO REFERENCE'
  END as status
FROM information_schema.table_constraints 
WHERE table_schema = 'public'
ORDER BY constraint_name;

-- 11. 最终汇总
SELECT 
  'FINAL SUMMARY' as category,
  'Objects with permission_change_log references' as description,
  COUNT(*) as count
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
  SELECT sequence_name FROM information_schema.sequences WHERE sequence_name LIKE '%permission_change_log%' AND sequence_schema = 'public'
  UNION ALL
  SELECT column_name FROM information_schema.columns WHERE column_name LIKE '%permission_change_log%' AND table_schema = 'public'
  UNION ALL
  SELECT policyname FROM pg_policies WHERE qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%'
  UNION ALL
  SELECT proname FROM pg_proc WHERE prosrc LIKE '%permission_change_log%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  UNION ALL
  SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_name LIKE '%permission_change_log%' AND table_schema = 'public'
) as all_refs;
