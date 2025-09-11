-- 测试合同相关表是否创建成功
-- 这个脚本会检查所有必要的表是否存在并可以访问

-- 检查表是否存在
SELECT 
  'contract_permissions' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_permissions') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'contract_file_versions' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_file_versions') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'contract_access_logs' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_access_logs') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'contract_reminders' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_reminders') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'contract_numbering_rules' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_numbering_rules') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'contract_tags' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_tags') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'contract_tag_relations' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_tag_relations') 
       THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'saved_searches' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_searches') 
       THEN 'EXISTS' ELSE 'MISSING' END as status;

-- 测试查询权限（如果表存在）
-- 这些查询应该返回空结果或少量数据，不应该报错

-- 测试合同权限表
SELECT 'Testing contract_permissions table...' as test;
SELECT COUNT(*) as count FROM public.contract_permissions LIMIT 1;

-- 测试合同文件版本表
SELECT 'Testing contract_file_versions table...' as test;
SELECT COUNT(*) as count FROM public.contract_file_versions LIMIT 1;

-- 测试合同访问日志表
SELECT 'Testing contract_access_logs table...' as test;
SELECT COUNT(*) as count FROM public.contract_access_logs LIMIT 1;

-- 测试合同提醒表
SELECT 'Testing contract_reminders table...' as test;
SELECT COUNT(*) as count FROM public.contract_reminders LIMIT 1;

-- 测试合同编号规则表
SELECT 'Testing contract_numbering_rules table...' as test;
SELECT COUNT(*) as count FROM public.contract_numbering_rules LIMIT 1;

-- 测试合同标签表
SELECT 'Testing contract_tags table...' as test;
SELECT COUNT(*) as count FROM public.contract_tags LIMIT 1;

-- 测试合同标签关系表
SELECT 'Testing contract_tag_relations table...' as test;
SELECT COUNT(*) as count FROM public.contract_tag_relations LIMIT 1;

-- 测试保存的搜索表
SELECT 'Testing saved_searches table...' as test;
SELECT COUNT(*) as count FROM public.saved_searches LIMIT 1;
