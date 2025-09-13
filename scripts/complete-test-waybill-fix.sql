-- 完整测试运单编辑和导入平台字段修复
-- 按顺序执行以下步骤

-- 步骤1: 检查当前状态
DO $$
BEGIN
    RAISE NOTICE '=== 步骤1: 检查当前状态 ===';
    
    -- 检查函数是否存在
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_logistics_summary_and_records') THEN
        RAISE NOTICE '✓ get_logistics_summary_and_records 函数存在';
    ELSE
        RAISE NOTICE '✗ get_logistics_summary_and_records 函数不存在';
    END IF;
    
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'import_logistics_data') THEN
        RAISE NOTICE '✓ import_logistics_data 函数存在';
    ELSE
        RAISE NOTICE '✗ import_logistics_data 函数不存在';
    END IF;
    
    -- 检查表结构
    IF EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'external_tracking_numbers'
    ) THEN
        RAISE NOTICE '✓ logistics_records表包含external_tracking_numbers字段';
    ELSE
        RAISE NOTICE '✗ logistics_records表缺少external_tracking_numbers字段';
    END IF;
    
    IF EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
        AND column_name = 'other_platform_names'
    ) THEN
        RAISE NOTICE '✓ logistics_records表包含other_platform_names字段';
    ELSE
        RAISE NOTICE '✗ logistics_records表缺少other_platform_names字段';
    END IF;
    
END $$;

-- 步骤2: 测试运单查询（包含平台字段）
DO $$
DECLARE
    result jsonb;
    record_count integer;
    test_record jsonb;
BEGIN
    RAISE NOTICE '=== 步骤2: 测试运单查询 ===';
    
    BEGIN
        result := public.get_logistics_summary_and_records();
        record_count := (result->>'totalCount')::integer;
        RAISE NOTICE '✓ 运单查询成功，记录数: %', record_count;
        
        -- 检查返回的数据结构
        IF result ? 'records' AND jsonb_array_length(result->'records') > 0 THEN
            test_record := result->'records'->0;
            
            -- 检查平台字段
            IF test_record ? 'external_tracking_numbers' THEN
                RAISE NOTICE '✓ 包含 external_tracking_numbers 字段';
            ELSE
                RAISE NOTICE '✗ 缺少 external_tracking_numbers 字段';
            END IF;
            
            IF test_record ? 'other_platform_names' THEN
                RAISE NOTICE '✓ 包含 other_platform_names 字段';
            ELSE
                RAISE NOTICE '✗ 缺少 other_platform_names 字段';
            END IF;
            
            -- 显示关键字段
            RAISE NOTICE '运单号: %', test_record->>'auto_number';
            RAISE NOTICE '司机姓名: %', test_record->>'driver_name';
            RAISE NOTICE '司机电话: %', test_record->>'driver_phone';
            RAISE NOTICE '车牌号: %', test_record->>'license_plate';
            RAISE NOTICE '装货地点: %', test_record->>'loading_location';
            RAISE NOTICE '卸货地点: %', test_record->>'unloading_location';
            
        ELSE
            RAISE NOTICE '⚠ 没有运单记录可供测试';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 运单查询测试失败: %', SQLERRM;
    END;
    
END $$;

-- 步骤3: 测试导入函数（不实际导入数据）
DO $$
DECLARE
    result jsonb;
    test_data jsonb;
BEGIN
    RAISE NOTICE '=== 步骤3: 测试导入函数 ===';
    
    -- 构建测试数据
    test_data := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试项目',
            'driver_name', '测试司机',
            'license_plate', '京A12345',
            'loading_location', '北京仓库',
            'unloading_location', '上海仓库',
            'loading_date', '2025-01-20T00:00:00Z',
            'loading_weight', '25.5',
            'current_cost', '1000',
            'extra_cost', '100',
            'external_tracking_numbers', jsonb_build_array(
                jsonb_build_object(
                    'platform', '测试平台',
                    'tracking_number', 'TEST123',
                    'status', 'pending',
                    'created_at', '2025-01-20T00:00:00Z'
                )
            ),
            'other_platform_names', ARRAY['测试平台1', '测试平台2']
        )
    );
    
    BEGIN
        -- 测试函数调用（预期会失败，因为项目不存在）
        result := public.import_logistics_data(test_data);
        
        RAISE NOTICE '✓ 导入函数调用成功';
        RAISE NOTICE '成功数量: %', result->>'success_count';
        RAISE NOTICE '失败数量: %', jsonb_array_length(result->'failures');
        
        -- 检查失败原因
        IF jsonb_array_length(result->'failures') > 0 THEN
            RAISE NOTICE '失败原因: %', result->'failures'->0->>'error';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 导入函数测试失败: %', SQLERRM;
    END;
    
END $$;

-- 步骤4: 总结测试结果
DO $$
BEGIN
    RAISE NOTICE '=== 步骤4: 测试结果总结 ===';
    RAISE NOTICE '如果以上所有测试都显示 ✓，说明修复成功';
    RAISE NOTICE '如果出现 ✗，说明需要进一步修复';
    RAISE NOTICE '=== 测试完成 ===';
END $$;
