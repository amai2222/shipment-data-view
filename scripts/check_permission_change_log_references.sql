-- 简单检查 permission_change_log 表的所有引用
-- 找出还在尝试访问这个表的对象

-- 检查表是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'permission_change_log'
    ) 
    THEN '表存在'
    ELSE '表不存在'
  END as table_status;

-- 检查是否有函数引用这个表
SELECT 
  COUNT(*) as function_count,
  'functions referencing permission_change_log' as description
FROM information_schema.routines 
WHERE routine_definition LIKE '%permission_change_log%'
  AND routine_schema = 'public';

-- 检查是否有视图引用这个表
SELECT 
  COUNT(*) as view_count,
  'views referencing permission_change_log' as description
FROM information_schema.views 
WHERE view_definition LIKE '%permission_change_log%'
  AND table_schema = 'public';

-- 检查是否有触发器引用这个表
SELECT 
  COUNT(*) as trigger_count,
  'triggers referencing permission_change_log' as description
FROM information_schema.triggers 
WHERE action_statement LIKE '%permission_change_log%'
  AND trigger_schema = 'public';

-- 显示所有相关对象
SELECT 
  'All objects' as category,
  COUNT(*) as total_count
FROM (
  SELECT routine_name FROM information_schema.routines WHERE routine_definition LIKE '%permission_change_log%' AND routine_schema = 'public'
  UNION ALL
  SELECT table_name FROM information_schema.views WHERE view_definition LIKE '%permission_change_log%' AND table_schema = 'public'
  UNION ALL
  SELECT trigger_name FROM information_schema.triggers WHERE action_statement LIKE '%permission_change_log%' AND trigger_schema = 'public'
) as all_refs;
