-- 简化版更新模式导入功能测试
-- 此脚本避免外键约束问题，专注于测试核心功能

-- 1. 测试预览函数
DO $$
DECLARE
    test_records jsonb;
    preview_result jsonb;
BEGIN
    RAISE NOTICE '=== 测试预览函数 ===';
    
    -- 创建测试数据
    test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试项目预览',
            'chain_name', '测试链路',
            'driver_name', '测试司机预览',
            'license_plate', '测试车牌预览',
            'driver_phone', '13800138000',
            'loading_location', '北京仓库',
            'unloading_location', '上海仓库',
            'loading_date', '2025-01-20',
            'loading_weight', '25.5',
            'unloading_weight', '25.0',
            'current_cost', '1000',
            'extra_cost', '100',
            'transport_type', '实际运输',
            'remarks', '测试备注',
            'external_tracking_numbers', jsonb_build_array(
                jsonb_build_object(
                    'platform', '货拉拉',
                    'tracking_number', 'HL20250120001',
                    'status', 'pending'
                )
            ),
            'other_platform_names', ARRAY['货拉拉', '满帮']
        )
    );

    -- 调用预览函数
    SELECT public.preview_import_with_update_mode(test_records) INTO preview_result;
    
    RAISE NOTICE '✅ 预览函数调用成功';
    RAISE NOTICE '新记录数量: %', jsonb_array_length(preview_result->'new_records');
    RAISE NOTICE '更新记录数量: %', jsonb_array_length(preview_result->'update_records');
    RAISE NOTICE '错误记录数量: %', jsonb_array_length(preview_result->'error_records');
    
    -- 显示预览结果详情
    IF jsonb_array_length(preview_result->'new_records') > 0 THEN
        RAISE NOTICE '新记录示例: %', preview_result->'new_records'->0;
    END IF;
    
    IF jsonb_array_length(preview_result->'update_records') > 0 THEN
        RAISE NOTICE '更新记录示例: %', preview_result->'update_records'->0;
    END IF;
    
    IF jsonb_array_length(preview_result->'error_records') > 0 THEN
        RAISE NOTICE '错误记录示例: %', preview_result->'error_records'->0;
    END IF;
END $$;

-- 2. 测试函数是否存在
DO $$
DECLARE
    function_exists boolean;
BEGIN
    RAISE NOTICE '=== 检查函数是否存在 ===';
    
    -- 检查预览函数
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'preview_import_with_update_mode'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ preview_import_with_update_mode 函数存在';
    ELSE
        RAISE NOTICE '❌ preview_import_with_update_mode 函数不存在';
    END IF;
    
    -- 检查导入函数
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'batch_import_logistics_records_with_update'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ batch_import_logistics_records_with_update 函数存在';
    ELSE
        RAISE NOTICE '❌ batch_import_logistics_records_with_update 函数不存在';
    END IF;
END $$;

-- 3. 测试JSON格式处理
DO $$
DECLARE
    test_json jsonb;
    test_array text[];
BEGIN
    RAISE NOTICE '=== 测试JSON格式处理 ===';
    
    -- 测试JSONB数组
    test_json := jsonb_build_array(
        jsonb_build_object(
            'platform', '货拉拉',
            'tracking_number', 'HL20250120001',
            'status', 'pending'
        )
    );
    
    RAISE NOTICE '✅ JSONB数组创建成功: %', test_json;
    
    -- 测试文本数组
    test_array := ARRAY['货拉拉', '满帮', '运满满'];
    RAISE NOTICE '✅ 文本数组创建成功: %', test_array;
    
    -- 测试空值处理
    test_json := '[]'::jsonb;
    test_array := '{}'::text[];
    RAISE NOTICE '✅ 空值处理正常: JSONB=% TEXT[]=%', test_json, test_array;
END $$;

-- 4. 测试重复检测逻辑
DO $$
DECLARE
    test_records jsonb;
    preview_result jsonb;
    duplicate_count integer;
BEGIN
    RAISE NOTICE '=== 测试重复检测逻辑 ===';
    
    -- 创建包含重复记录的测试数据
    test_records := jsonb_build_array(
        -- 记录1
        jsonb_build_object(
            'project_name', '重复测试项目',
            'driver_name', '重复测试司机',
            'license_plate', '重复测试车牌',
            'loading_location', '重复测试装货地点',
            'unloading_location', '重复测试卸货地点',
            'loading_date', '2025-01-22',
            'loading_weight', '30.0',
            'current_cost', '1000',
            'extra_cost', '100',
            'transport_type', '实际运输',
            'remarks', '重复测试记录1'
        ),
        -- 记录2（与记录1重复）
        jsonb_build_object(
            'project_name', '重复测试项目',
            'driver_name', '重复测试司机',
            'license_plate', '重复测试车牌',
            'loading_location', '重复测试装货地点',
            'unloading_location', '重复测试卸货地点',
            'loading_date', '2025-01-22',
            'loading_weight', '30.0',
            'current_cost', '1500', -- 不同的金额
            'extra_cost', '200',    -- 不同的额外费用
            'transport_type', '实际运输',
            'remarks', '重复测试记录2' -- 不同的备注
        )
    );

    -- 调用预览函数
    SELECT public.preview_import_with_update_mode(test_records) INTO preview_result;
    
    duplicate_count := jsonb_array_length(preview_result->'update_records');
    
    RAISE NOTICE '✅ 重复检测测试完成';
    RAISE NOTICE '总记录数: 2';
    RAISE NOTICE '检测到的重复记录数: %', duplicate_count;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE '✅ 重复检测逻辑正常工作';
        RAISE NOTICE '重复记录详情: %', preview_result->'update_records';
    ELSE
        RAISE NOTICE '⚠️ 未检测到重复记录，可能需要检查重复检测逻辑';
    END IF;
END $$;

-- 完成提示
SELECT '更新模式导入功能简化测试完成！' as message;
