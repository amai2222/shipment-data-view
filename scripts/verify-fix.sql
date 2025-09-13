-- 验证修复是否成功
DO $$
DECLARE
    result jsonb;
BEGIN
    RAISE NOTICE '=== 验证错误报告修复 ===';
    
    -- 测试错误报告功能
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
    
    RAISE NOTICE '结果: %', result;
    
    -- 检查是否有错误详情
    IF result ? 'error_details' THEN
        RAISE NOTICE '✓ 错误详情字段存在';
    ELSE
        RAISE NOTICE '✗ 错误详情字段不存在';
    END IF;
    
    IF (result->>'error_count')::integer > 0 THEN
        RAISE NOTICE '✓ 错误计数大于0';
    ELSE
        RAISE NOTICE '✗ 错误计数为0';
    END IF;
    
END $$;
