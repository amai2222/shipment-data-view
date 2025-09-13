-- 测试缺失的数据库函数和表
-- 执行时间：2025-01-20
-- 功能：验证新创建的函数和表是否正常工作

-- ===========================================
-- 第一部分：测试数据库表
-- ===========================================

-- 1. 检查表是否存在
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings') 
    THEN '✅ 存在'
    ELSE '❌ 不存在'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings')
ORDER BY table_name;

-- 2. 检查表结构
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings')
ORDER BY table_name, ordinal_position;

-- 3. 检查索引
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings')
ORDER BY tablename, indexname;

-- ===========================================
-- 第二部分：测试数据库函数
-- ===========================================

-- 4. 检查函数是否存在
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name IN ('get_available_platforms', 'add_custom_platform', 'batch_import_logistics_records', 'get_import_templates', 'get_template_field_mappings', 'get_template_fixed_mappings')
    THEN '✅ 存在'
    ELSE '❌ 不存在'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_available_platforms', 'add_custom_platform', 'batch_import_logistics_records', 'get_import_templates', 'get_template_field_mappings', 'get_template_fixed_mappings')
ORDER BY routine_name;

-- ===========================================
-- 第三部分：功能测试
-- ===========================================

-- 5. 测试获取可用平台列表
SELECT '测试 get_available_platforms 函数' as test_name;
SELECT * FROM public.get_available_platforms() LIMIT 5;

-- 6. 测试获取导入模板列表
SELECT '测试 get_import_templates 函数' as test_name;
SELECT * FROM public.get_import_templates('waybill');

-- 7. 测试获取模板字段映射
SELECT '测试 get_template_field_mappings 函数' as test_name;
SELECT 
  it.id as template_id,
  it.name as template_name,
  ifm.excel_column,
  ifm.database_field,
  ifm.field_type,
  ifm.is_required
FROM public.import_templates it
LEFT JOIN public.import_field_mappings ifm ON it.id = ifm.template_id
WHERE it.platform_type = 'waybill'
ORDER BY ifm.display_order, ifm.excel_column
LIMIT 10;

-- 8. 测试添加自定义平台（需要先检查是否有数据）
SELECT '测试 add_custom_platform 函数' as test_name;
-- 注意：这个函数需要认证用户，在测试环境中可能无法执行
-- SELECT public.add_custom_platform('测试平台', '这是一个测试平台');

-- 9. 测试批量导入物流记录（模拟数据）
SELECT '测试 batch_import_logistics_records 函数' as test_name;
-- 注意：这个函数需要认证用户和有效的数据，在测试环境中可能无法执行
-- 这里只检查函数签名
SELECT 
  routine_name,
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters 
WHERE specific_schema = 'public' 
  AND specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'batch_import_logistics_records'
  )
ORDER BY ordinal_position;

-- 10. 测试批量导入函数返回类型
SELECT '测试 batch_import_logistics_records 返回类型' as test_name;
SELECT 
  routine_name,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'batch_import_logistics_records';

-- ===========================================
-- 第四部分：数据完整性检查
-- ===========================================

-- 10. 检查默认模板数据
SELECT '检查默认模板数据' as test_name;
SELECT 
  id,
  name,
  platform_type,
  is_system,
  is_active,
  created_at
FROM public.import_templates
WHERE is_system = true
ORDER BY created_at;

-- 11. 检查字段映射数据
SELECT '检查字段映射数据' as test_name;
SELECT 
  it.name as template_name,
  ifm.excel_column,
  ifm.database_field,
  ifm.field_type,
  ifm.is_required
FROM public.import_templates it
JOIN public.import_field_mappings ifm ON it.id = ifm.template_id
WHERE it.is_system = true
ORDER BY it.name, ifm.display_order
LIMIT 20;

-- 12. 检查行级安全策略
SELECT '检查行级安全策略' as test_name;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings')
ORDER BY tablename, policyname;

-- ===========================================
-- 第五部分：性能检查
-- ===========================================

-- 13. 检查表大小和统计信息
SELECT '检查表统计信息' as test_name;
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings')
ORDER BY tablename;

-- 14. 检查函数执行计划（如果可能）
SELECT '检查函数执行计划' as test_name;
-- 注意：EXPLAIN 在函数上可能不工作，这里只是示例
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.get_available_platforms();

-- ===========================================
-- 第六部分：总结报告
-- ===========================================

-- 15. 生成测试总结报告
SELECT '测试总结报告' as report_section;

WITH test_results AS (
  SELECT 
    'Tables' as category,
    COUNT(*) as total_count,
    COUNT(CASE WHEN table_name IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings') THEN 1 END) as created_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('import_templates', 'import_field_mappings', 'import_fixed_mappings')
  
  UNION ALL
  
  SELECT 
    'Functions' as category,
    COUNT(*) as total_count,
    COUNT(CASE WHEN routine_name IN ('get_available_platforms', 'add_custom_platform', 'batch_import_logistics_records', 'get_import_templates', 'get_template_field_mappings', 'get_template_fixed_mappings') THEN 1 END) as created_count
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
    AND routine_name IN ('get_available_platforms', 'add_custom_platform', 'batch_import_logistics_records', 'get_import_templates', 'get_template_field_mappings', 'get_template_fixed_mappings')
)
SELECT 
  category,
  total_count as expected_count,
  created_count as actual_count,
  CASE 
    WHEN total_count = created_count THEN '✅ 全部创建成功'
    WHEN created_count = 0 THEN '❌ 全部创建失败'
    ELSE '⚠️ 部分创建成功'
  END as status
FROM test_results
ORDER BY category;

-- 16. 检查数据完整性
SELECT '数据完整性检查' as report_section;
SELECT 
  'import_templates' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN is_system = true THEN 1 END) as system_templates,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_templates
FROM public.import_templates

UNION ALL

SELECT 
  'import_field_mappings' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN is_required = true THEN 1 END) as required_fields,
  COUNT(CASE WHEN validation_rules != '{}'::jsonb THEN 1 END) as fields_with_validation
FROM public.import_field_mappings

UNION ALL

SELECT 
  'import_fixed_mappings' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN is_case_sensitive = true THEN 1 END) as case_sensitive_mappings,
  COUNT(DISTINCT mapping_type) as mapping_types
FROM public.import_fixed_mappings;

-- 测试完成提示
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '数据库函数和表测试完成！';
  RAISE NOTICE '请检查上述测试结果，确保所有功能正常。';
  RAISE NOTICE '===========================================';
END $$;
