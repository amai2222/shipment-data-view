-- 快速测试脚本 - 检查合同管理功能是否正常

-- 1. 检查函数是否存在
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

-- 3. 测试简单查询
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') THEN
    RAISE NOTICE '合同表存在，尝试查询...';
    PERFORM COUNT(*) FROM public.contracts LIMIT 1;
    RAISE NOTICE '查询成功！合同管理功能应该可以正常使用了。';
  ELSE
    RAISE NOTICE '合同表不存在，需要运行修复脚本';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '查询失败: %', SQLERRM;
END $$;
