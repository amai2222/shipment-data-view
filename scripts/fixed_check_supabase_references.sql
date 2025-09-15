-- 修复后的 Supabase 检查脚本
-- 检查所有可能引用 permission_change_log 表的对象

-- 1. 检查所有函数定义
SELECT 
  'Function' as object_type,
  routine_name as object_name,
  routine_type,
  CASE 
    WHEN routine_definition LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 2. 检查所有触发器
SELECT 
  'Trigger' as object_type,
  trigger_name as object_name,
  event_object_table as table_name,
  CASE 
    WHEN action_statement LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- 3. 检查所有视图
SELECT 
  'View' as object_type,
  table_name as object_name,
  CASE 
    WHEN view_definition LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. 检查所有表
SELECT 
  'Table' as object_type,
  table_name as object_name,
  table_type,
  CASE 
    WHEN table_name LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 5. 检查所有索引
SELECT 
  'Index' as object_type,
  indexname as object_name,
  tablename as table_name,
  CASE 
    WHEN indexdef LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY indexname;

-- 6. 检查所有序列
SELECT 
  'Sequence' as object_type,
  sequence_name as object_name,
  CASE 
    WHEN sequence_name LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 7. 检查所有列
SELECT 
  'Column' as object_type,
  table_name,
  column_name,
  CASE 
    WHEN column_name LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, column_name;

-- 8. 检查所有 RLS 策略
SELECT 
  'RLS Policy' as object_type,
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM pg_policies 
ORDER BY tablename, policyname;

-- 9. 检查所有扩展函数
SELECT 
  'Extension Function' as object_type,
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 10. 检查所有约束
SELECT 
  'Constraint' as object_type,
  constraint_name as object_name,
  table_name,
  constraint_type,
  CASE 
    WHEN constraint_name LIKE '%permission_change_log%' THEN 'FOUND'
    ELSE 'NOT FOUND'
  END as status
FROM information_schema.table_constraints 
WHERE table_schema = 'public'
ORDER BY constraint_name;

-- 11. 最终汇总 - 只显示找到引用的对象
SELECT 
  'FOUND REFERENCES' as category,
  object_type,
  object_name,
  additional_info
FROM (
  SELECT 'Function' as object_type, routine_name as object_name, routine_type as additional_info
  FROM information_schema.routines 
  WHERE routine_definition LIKE '%permission_change_log%' AND routine_schema = 'public'
  
  UNION ALL
  
  SELECT 'Trigger' as object_type, trigger_name as object_name, event_object_table as additional_info
  FROM information_schema.triggers 
  WHERE action_statement LIKE '%permission_change_log%' AND trigger_schema = 'public'
  
  UNION ALL
  
  SELECT 'View' as object_type, table_name as object_name, 'view' as additional_info
  FROM information_schema.views 
  WHERE view_definition LIKE '%permission_change_log%' AND table_schema = 'public'
  
  UNION ALL
  
  SELECT 'Table' as object_type, table_name as object_name, table_type as additional_info
  FROM information_schema.tables 
  WHERE table_name LIKE '%permission_change_log%' AND table_schema = 'public'
  
  UNION ALL
  
  SELECT 'Index' as object_type, indexname as object_name, tablename as additional_info
  FROM pg_indexes 
  WHERE indexdef LIKE '%permission_change_log%' AND schemaname = 'public'
  
  UNION ALL
  
  SELECT 'Sequence' as object_type, sequence_name as object_name, 'sequence' as additional_info
  FROM information_schema.sequences 
  WHERE sequence_name LIKE '%permission_change_log%' AND sequence_schema = 'public'
  
  UNION ALL
  
  SELECT 'Column' as object_type, column_name as object_name, table_name as additional_info
  FROM information_schema.columns 
  WHERE column_name LIKE '%permission_change_log%' AND table_schema = 'public'
  
  UNION ALL
  
  SELECT 'RLS Policy' as object_type, policyname as object_name, tablename as additional_info
  FROM pg_policies 
  WHERE qual LIKE '%permission_change_log%' OR with_check LIKE '%permission_change_log%'
  
  UNION ALL
  
  SELECT 'Extension Function' as object_type, proname as object_name, 'extension' as additional_info
  FROM pg_proc 
  WHERE prosrc LIKE '%permission_change_log%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  
  UNION ALL
  
  SELECT 'Constraint' as object_type, constraint_name as object_name, table_name as additional_info
  FROM information_schema.table_constraints 
  WHERE constraint_name LIKE '%permission_change_log%' AND table_schema = 'public'
) as all_refs
ORDER BY object_type, object_name;
