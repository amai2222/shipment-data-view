-- 检查合同相关表是否存在
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN (
  'contract_permissions',
  'contract_file_versions', 
  'contract_access_logs',
  'contract_numbering_rules',
  'contract_tags',
  'contract_tag_relations',
  'contract_reminders',
  'saved_searches'
)
ORDER BY tablename;

-- 检查表结构
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN (
  'contract_permissions',
  'contract_file_versions', 
  'contract_access_logs',
  'contract_numbering_rules',
  'contract_tags',
  'contract_tag_relations',
  'contract_reminders',
  'saved_searches'
)
ORDER BY table_name, ordinal_position;

-- 检查RLS策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN (
  'contract_permissions',
  'contract_file_versions', 
  'contract_access_logs',
  'contract_numbering_rules',
  'contract_tags',
  'contract_tag_relations',
  'contract_reminders',
  'saved_searches'
)
ORDER BY tablename, policyname;
