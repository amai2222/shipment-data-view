-- 简单测试错误报告功能
DO $$
DECLARE
    result jsonb;
BEGIN
    RAISE NOTICE '=== 测试错误报告功能 ===';
    
    -- 测试不存在的项目
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
    
END $$;
