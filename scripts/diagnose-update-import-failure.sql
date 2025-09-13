-- 诊断更新模式导入失败的原因
-- 检查可能导致更新失败的问题

DO $$
DECLARE
    test_project_name text := '测试项目';
    test_driver_name text := '测试司机';
    test_license_plate text := '京A12345';
    test_loading_location text := '北京仓库';
    test_unloading_location text := '上海仓库';
    test_loading_date timestamptz := '2025-01-20T00:00:00Z';
    test_loading_weight numeric := 25.5;
    
    existing_record_id uuid;
    existing_auto_number text;
    project_exists boolean;
    driver_exists boolean;
    location_exists boolean;
BEGIN
    RAISE NOTICE '=== 诊断更新模式导入失败原因 ===';
    
    -- 1. 检查项目是否存在
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE name = test_project_name) INTO project_exists;
    RAISE NOTICE '1. 项目检查: %', CASE WHEN project_exists THEN '存在' ELSE '不存在' END;
    
    -- 2. 检查司机是否存在
    SELECT EXISTS(SELECT 1 FROM public.drivers WHERE name = test_driver_name) INTO driver_exists;
    RAISE NOTICE '2. 司机检查: %', CASE WHEN driver_exists THEN '存在' ELSE '不存在' END;
    
    -- 3. 检查地点是否存在
    SELECT EXISTS(SELECT 1 FROM public.locations WHERE name = test_loading_location) INTO location_exists;
    RAISE NOTICE '3. 装货地点检查: %', CASE WHEN location_exists THEN '存在' ELSE '不存在' END;
    
    SELECT EXISTS(SELECT 1 FROM public.locations WHERE name = test_unloading_location) INTO location_exists;
    RAISE NOTICE '4. 卸货地点检查: %', CASE WHEN location_exists THEN '存在' ELSE '不存在' END;
    
    -- 4. 检查是否存在匹配的运单记录
    SELECT 
        lr.id,
        lr.auto_number
    INTO existing_record_id, existing_auto_number
    FROM public.logistics_records lr
    WHERE lr.project_name = test_project_name
    AND lr.driver_name = test_driver_name
    AND lr.license_plate = test_license_plate
    AND lr.loading_location = test_loading_location
    AND lr.unloading_location = test_unloading_location
    AND lr.loading_date = test_loading_date
    AND lr.loading_weight = test_loading_weight
    LIMIT 1;
    
    IF existing_record_id IS NOT NULL THEN
        RAISE NOTICE '5. 匹配的运单记录: 存在 (ID: %, 运单号: %)', existing_record_id, existing_auto_number;
    ELSE
        RAISE NOTICE '5. 匹配的运单记录: 不存在';
    END IF;
    
    -- 5. 检查数据库函数是否存在
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'batch_import_logistics_records_with_update') THEN
        RAISE NOTICE '6. 数据库函数: 存在';
    ELSE
        RAISE NOTICE '6. 数据库函数: 不存在';
    END IF;
    
    -- 6. 检查用户权限
    IF auth.uid() IS NOT NULL THEN
        RAISE NOTICE '7. 用户权限: 已登录 (ID: %)', auth.uid();
    ELSE
        RAISE NOTICE '7. 用户权限: 未登录';
    END IF;
    
    RAISE NOTICE '=== 诊断完成 ===';
    RAISE NOTICE '建议检查项目:';
    RAISE NOTICE '1. 确保项目名称在系统中存在';
    RAISE NOTICE '2. 确保司机信息在系统中存在';
    RAISE NOTICE '3. 确保地点信息在系统中存在';
    RAISE NOTICE '4. 确保存在匹配的运单记录用于更新';
    RAISE NOTICE '5. 确保数据库函数已正确创建';
    
END $$;
