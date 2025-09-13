-- 简单测试
DO $$
DECLARE
    result jsonb;
BEGIN
    RAISE NOTICE '=== 简单测试 ===';
    
    -- 检查函数是否存在
    IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'batch_import_logistics_records_with_update') THEN
        RAISE NOTICE '函数不存在，无法测试';
        RETURN;
    END IF;
    
    -- 测试函数
    BEGIN
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
        
        RAISE NOTICE '测试结果: %', result;
        
        -- 检查错误详情
        IF result ? 'error_details' THEN
            RAISE NOTICE '✓ 错误详情字段存在';
        ELSE
            RAISE NOTICE '✗ 错误详情字段不存在';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '测试失败: %', SQLERRM;
    END;
    
    RAISE NOTICE '=== 测试完成 ===';
    
END $$;
