-- 最终测试错误报告功能
DO $$
DECLARE
    result jsonb;
BEGIN
    RAISE NOTICE '=== 开始测试错误报告功能 ===';
    
    -- 测试1: 检查函数是否存在
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'batch_import_logistics_records_with_update') THEN
        RAISE NOTICE '✓ 数据库函数存在';
    ELSE
        RAISE NOTICE '✗ 数据库函数不存在，需要先执行修复脚本';
        RETURN;
    END IF;
    
    -- 测试2: 测试错误报告
    RAISE NOTICE '测试错误报告功能...';
    
    result := public.batch_import_logistics_records_with_update(
        jsonb_build_array(
            jsonb_build_object(
                'project_name', '不存在的项目',
                'driver_name', '测试司机',
                'license_plate', '京A12345',
                'loading_location', '北京仓库',
                'unloading_location', '上海仓库',
                'loading_date', '2025-01-20T00:00:00Z',
                'loading_weight', '25.5',
                'current_cost', '1000',
                'extra_cost', '100'
            )
        ),
        true
    );
    
    RAISE NOTICE '测试结果:';
    RAISE NOTICE '  成功数量: %', result->>'success_count';
    RAISE NOTICE '  失败数量: %', result->>'error_count';
    RAISE NOTICE '  创建数量: %', result->>'inserted_count';
    RAISE NOTICE '  更新数量: %', result->>'updated_count';
    
    -- 检查是否有错误详情
    IF (result->>'error_count')::integer > 0 THEN
        RAISE NOTICE '  错误详情: %', result->'error_details';
    ELSE
        RAISE NOTICE '  没有错误详情';
    END IF;
    
    RAISE NOTICE '=== 测试完成 ===';
    
END $$;
