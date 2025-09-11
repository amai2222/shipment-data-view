-- 测试合同查询的脚本
-- 验证布尔字段查询是否正常工作

-- 1. 检查 contracts 表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'contracts' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 测试简单的合同查询
SELECT COUNT(*) as total_contracts FROM public.contracts;

-- 3. 测试布尔字段查询
SELECT COUNT(*) as confidential_contracts 
FROM public.contracts 
WHERE is_confidential = true;

SELECT COUNT(*) as non_confidential_contracts 
FROM public.contracts 
WHERE is_confidential = false;

-- 4. 测试带标签的查询
SELECT 
  c.id,
  c.contract_number,
  c.counterparty_company,
  c.is_confidential,
  c.status,
  c.priority
FROM public.contracts c
LEFT JOIN public.contract_tag_relations ctr ON c.id = ctr.contract_id
LEFT JOIN public.contract_tags ct ON ctr.tag_id = ct.id
ORDER BY c.created_at DESC
LIMIT 5;

-- 5. 检查是否有数据
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ 合同表有数据'
    ELSE '✗ 合同表为空'
  END as data_check
FROM public.contracts;
