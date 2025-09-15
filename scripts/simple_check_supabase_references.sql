-- 检查 Supabase Edge Functions 中是否引用了 permission_change_log
-- 这个脚本会检查所有可能的地方

-- 1. 检查所有函数中是否包含 permission_change_log
SELECT 
  'Functions with permission_change_log' as category,
  routine_name as function_name,
  routine_type,
  CASE 
    WHEN routine_definition LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 2. 检查所有触发器
SELECT 
  'Triggers with permission_change_log' as category,
  trigger_name,
  event_object_table as table_name,
  CASE 
    WHEN action_statement LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- 3. 检查所有视图
SELECT 
  'Views with permission_change_log' as category,
  table_name as view_name,
  CASE 
    WHEN view_definition LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. 检查所有表
SELECT 
  'Tables with permission_change_log' as category,
  table_name,
  table_type,
  CASE 
    WHEN table_name LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 5. 检查所有索引
SELECT 
  'Indexes with permission_change_log' as category,
  indexname,
  tablename,
  CASE 
    WHEN indexdef LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY indexname;

-- 6. 检查所有序列
SELECT 
  'Sequences with permission_change_log' as category,
  sequence_name,
  CASE 
    WHEN sequence_name LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 7. 检查所有列
SELECT 
  'Columns with permission_change_log' as category,
  table_name,
  column_name,
  CASE 
    WHEN column_name LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, column_name;

-- 8. 检查所有 RLS 策略
SELECT 
  'RLS Policies with permission_change_log' as category,
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM pg_policies 
ORDER BY tablename, policyname;

-- 9. 检查所有扩展函数
SELECT 
  'Extension Functions with permission_change_log' as category,
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%permission_change_log%' THEN 'YES'
    ELSE 'NO'
  END as contains_reference
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 10. 汇总统计
SELECT 
  'Summary' as category,
  'Total objects checked' as description,
  COUNT(*) as count
FROM (
  SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'
  UNION ALL
  SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  UNION ALL
  SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL
  SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  UNION ALL
  SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
) as all_objects;
