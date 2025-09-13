-- 测试平台字段修复
-- 验证运单管理新增/编辑界面和Excel导入功能

-- 1. 测试运单管理新增/编辑界面的平台字段输入
DO $$
DECLARE
    test_record jsonb;
    result jsonb;
    user_id_val uuid;
BEGIN
    RAISE NOTICE '=== 测试运单管理平台字段输入 ===';
    
    -- 获取当前用户ID
    SELECT auth.uid() INTO user_id_val;
    IF user_id_val IS NULL THEN
        user_id_val := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;
    
    -- 创建测试项目（如果不存在）
    INSERT INTO public.projects (id, name, start_date, end_date, manager, loading_address, unloading_address, user_id)
    VALUES (
        'test-platform-project'::uuid,
        '测试平台字段项目',
        '2025-01-01',
        '2025-12-31',
        '测试管理员',
        '测试装货地址',
        '测试卸货地址',
        user_id_val
    )
    ON CONFLICT (id) DO NOTHING;

    -- 创建包含平台字段的测试数据
    test_record := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试平台字段项目',
            'chain_name', '测试链路',
            'driver_name', '测试司机平台',
            'license_plate', '测试车牌平台',
            'driver_phone', '13800138000',
            'loading_location', '北京仓库',
            'unloading_location', '上海仓库',
            'loading_date', '2025-01-20',
            'loading_weight', '25.5',
            'unloading_weight', '25.0',
            'current_cost', '1000',
            'extra_cost', '100',
            'transport_type', '实际运输',
            'remarks', '测试平台字段',
            'external_tracking_numbers', jsonb_build_array(
                jsonb_build_object(
                    'platform', '货拉拉',
                    'tracking_number', 'HL20250120001',
                    'status', 'pending',
                    'created_at', '2025-01-20T08:00:00Z'
                ),
                jsonb_build_object(
                    'platform', '满帮',
                    'tracking_number', 'MB20250120001',
                    'status', 'pending',
                    'created_at', '2025-01-20T08:00:00Z'
                )
            ),
            'other_platform_names', ARRAY['货拉拉', '满帮', '运满满']
        )
    );

    -- 调用 import_logistics_data 函数
    SELECT public.import_logistics_data(test_record) INTO result;
    
    RAISE NOTICE '✅ import_logistics_data 函数调用成功';
    RAISE NOTICE '成功数量: %', result->>'success_count';
    RAISE NOTICE '失败数量: %', jsonb_array_length(result->'failures');
    
    -- 验证导入的数据
    IF (result->>'success_count')::integer > 0 THEN
        RAISE NOTICE '✅ 数据导入成功，正在验证平台字段...';
        
        -- 检查导入的记录
        PERFORM 1 FROM public.logistics_records 
        WHERE project_name = '测试平台字段项目'
        AND driver_name = '测试司机平台'
        AND external_tracking_numbers IS NOT NULL
        AND other_platform_names IS NOT NULL;
        
        IF FOUND THEN
            RAISE NOTICE '✅ 平台字段数据已正确保存到数据库';
            
            -- 显示平台字段内容
            FOR result IN 
                SELECT 
                    auto_number,
                    external_tracking_numbers,
                    other_platform_names
                FROM public.logistics_records 
                WHERE project_name = '测试平台字段项目'
                AND driver_name = '测试司机平台'
                LIMIT 1
            LOOP
                RAISE NOTICE '运单号: %', result.auto_number;
                RAISE NOTICE '外部运单号: %', result.external_tracking_numbers;
                RAISE NOTICE '其他平台名称: %', result.other_platform_names;
            END LOOP;
        ELSE
            RAISE NOTICE '❌ 平台字段数据未正确保存';
        END IF;
    ELSE
        RAISE NOTICE '❌ 数据导入失败';
        RAISE NOTICE '失败详情: %', result->'failures';
    END IF;
END $$;

-- 2. 清理测试数据
DO $$
DECLARE
    deleted_count integer;
BEGIN
    RAISE NOTICE '=== 清理测试数据 ===';
    
    -- 删除测试记录
    DELETE FROM public.logistics_records WHERE project_name = '测试平台字段项目';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '删除运单记录: % 条', deleted_count;
    
    -- 删除测试项目
    DELETE FROM public.projects WHERE id = 'test-platform-project'::uuid;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '删除项目: % 条', deleted_count;
    
    RAISE NOTICE '✅ 测试数据清理完成';
END $$;

-- 完成提示
SELECT '平台字段修复测试完成！' as message;
