-- 测试数据库连接和表结构的脚本
-- 运行此脚本来检查合同管理相关的表和权限

-- 1. 检查必要的函数是否存在
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_authenticated_user') 
    THEN '✓ is_authenticated_user 函数存在'
    ELSE '✗ is_authenticated_user 函数不存在'
  END as function_check;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') 
    THEN '✓ is_admin 函数存在'
    ELSE '✗ is_admin 函数不存在'
  END as function_check;

-- 2. 检查合同表是否存在
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') 
    THEN '✓ contracts 表存在'
    ELSE '✗ contracts 表不存在'
  END as table_check;

-- 3. 检查合同表的字段
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contracts' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 检查RLS是否启用
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('contracts', 'contract_tags', 'contract_permissions')
AND schemaname = 'public';

-- 5. 检查RLS策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'contracts' 
AND schemaname = 'public';

-- 6. 检查当前用户权限
SELECT 
  current_user as current_user,
  session_user as session_user,
  current_database() as current_database;

-- 7. 测试简单的查询（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') THEN
    RAISE NOTICE '合同表存在，尝试查询...';
    PERFORM COUNT(*) FROM public.contracts LIMIT 1;
    RAISE NOTICE '查询成功！';
  ELSE
    RAISE NOTICE '合同表不存在，需要运行修复脚本';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '查询失败: %', SQLERRM;
END $$;
