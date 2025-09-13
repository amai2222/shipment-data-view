-- 测试更新模式导入错误详情功能
-- 验证错误信息是否正确返回

DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    RAISE NOTICE '=== 测试更新模式导入错误详情功能 ===';
    
    -- 创建测试数据（包含一些错误数据）
    test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '不存在的项目',
            'driver_name', '测试司机1',
            'license_plate', '京A12345',
            'loading_location', '北京仓库',
            'unloading_location', '上海仓库',
            'loading_date', '2025-01-20T00:00:00Z',
            'loading_weight', '25.5',
            'current_cost', '1000',
            'extra_cost', '100'
        ),
        jsonb_build_object(
            'project_name', '测试项目',
            'driver_name', '测试司机2',
            'license_plate', '沪B67890',
            'loading_location', '上海仓库',
            'unloading_location', '广州仓库',
            'loading_date', '2025-01-21T00:00:00Z',
            'loading_weight', '30.0',
            'current_cost', '2000',
            'extra_cost', '200'
        )
    );
    
    -- 测试更新模式导入
    RAISE NOTICE '1. 测试更新模式导入...';
    result := public.batch_import_logistics_records_with_update(test_records, true);
    
    -- 显示结果
    RAISE NOTICE '导入结果:';
    RAISE NOTICE '  成功数量: %', result->>'success_count';
    RAISE NOTICE '  失败数量: %', result->>'error_count';
    RAISE NOTICE '  创建数量: %', result->>'inserted_count';
    RAISE NOTICE '  更新数量: %', result->>'updated_count';
    
    -- 显示错误详情
    IF (result->>'error_count')::integer > 0 THEN
        RAISE NOTICE '错误详情:';
        RAISE NOTICE '%', result->'error_details';
    END IF;
    
    RAISE NOTICE '=== 测试完成 ===';
    
END $$;
