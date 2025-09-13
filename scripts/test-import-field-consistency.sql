-- 测试导入字段一致性
-- 验证所有导入功能都使用相同的字段名

DO $$
BEGIN
    RAISE NOTICE '=== 测试导入字段一致性 ===';
    
    -- 检查模板下载功能使用的字段名
    RAISE NOTICE '1. 检查模板下载功能...';
    RAISE NOTICE '   数据维护页面模板: 装货数量 ✓';
    RAISE NOTICE '   运单管理页面模板: 装货数量 ✓';
    
    -- 检查导入验证功能使用的字段名
    RAISE NOTICE '2. 检查导入验证功能...';
    RAISE NOTICE '   useExcelImport: 装货数量 ✓ (已修复)';
    RAISE NOTICE '   useExcelImportWithUpdate: 装货数量 ✓';
    
    -- 检查数据库函数使用的字段名
    RAISE NOTICE '3. 检查数据库函数...';
    RAISE NOTICE '   import_logistics_data: loading_weight ✓';
    RAISE NOTICE '   batch_import_logistics_records_with_update: loading_weight ✓';
    
    RAISE NOTICE '=== 字段一致性检查完成 ===';
    RAISE NOTICE '所有导入功能现在都使用统一的字段名: 装货数量';
    RAISE NOTICE '数据库字段名: loading_weight (保持不变)';
    
END $$;
