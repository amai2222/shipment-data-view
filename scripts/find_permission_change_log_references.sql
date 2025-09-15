-- 检查所有可能引用 permission_change_log 表的地方
-- 这个脚本会找出所有还在尝试访问这个表的对象

-- 1. 检查所有函数定义
SELECT 
  'Function' as object_type,
  routine_name as object_name,
  routine_definition as definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%permission_change_log%'
  AND routine_schema = 'public';

-- 2. 检查所有视图定义
SELECT 
  'View' as object_type,
  table_name as object_name,
  view_definition as definition
FROM information_schema.views 
WHERE view_definition LIKE '%permission_change_log%'
  AND table_schema = 'public';

-- 3. 检查所有触发器
SELECT 
  'Trigger' as object_type,
  trigger_name as object_name,
  event_manipulation as event,
  action_statement as definition
FROM information_schema.triggers 
WHERE action_statement LIKE '%permission_change_log%'
  AND trigger_schema = 'public';

-- 4. 检查所有约束
SELECT 
  'Constraint' as object_type,
  constraint_name as object_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE constraint_name LIKE '%permission_change_log%'
  AND table_schema = 'public';

-- 5. 检查所有索引
SELECT 
  'Index' as object_type,
  indexname as object_name,
  tablename,
  indexdef as definition
FROM pg_indexes 
WHERE indexdef LIKE '%permission_change_log%'
  AND schemaname = 'public';

-- 6. 检查所有序列
SELECT 
  'Sequence' as object_type,
  sequence_name as object_name,
  data_type
FROM information_schema.sequences 
WHERE sequence_name LIKE '%permission_change_log%'
  AND sequence_schema = 'public';

-- 7. 检查所有表
SELECT 
  'Table' as object_type,
  table_name as object_name,
  table_type
FROM information_schema.tables 
WHERE table_name LIKE '%permission_change_log%'
  AND table_schema = 'public';
