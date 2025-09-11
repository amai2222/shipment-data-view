-- 调试合同相关表的问题
-- 这个脚本会检查表是否存在以及是否有数据

-- 1. 检查 contracts 表是否存在
SELECT 
  'contracts' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') 
       THEN 'EXISTS' ELSE 'MISSING' END as status;

-- 2. 检查 contracts 表的结构
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contracts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查 contracts 表是否有数据
SELECT COUNT(*) as contract_count FROM public.contracts;

-- 4. 检查 contract_permissions 表是否有数据
SELECT COUNT(*) as permission_count FROM public.contract_permissions;

-- 5. 测试简单的查询
SELECT * FROM public.contract_permissions LIMIT 5;

-- 6. 测试带 JOIN 的查询
SELECT 
  cp.*,
  c.contract_number,
  c.counterparty_company,
  c.our_company
FROM public.contract_permissions cp
LEFT JOIN public.contracts c ON cp.contract_id = c.id
LIMIT 5;
