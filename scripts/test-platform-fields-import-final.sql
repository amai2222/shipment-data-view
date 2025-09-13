-- 测试平台字段导入功能
-- 验证Excel导入时平台字段是否正确处理

-- 1. 检查数据库函数是否存在
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN (
    'preview_import_with_duplicates_check',
    'batch_import_logistics_records',
    'test_platform_fields_import'
) 
AND routine_schema = 'public';

-- 2. 检查logistics_records表结构
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
AND table_schema = 'public'
AND column_name IN ('external_tracking_numbers', 'other_platform_names')
ORDER BY ordinal_position;

-- 3. 测试preview_import_with_duplicates_check函数
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    -- 创建包含平台字段的测试数据
    test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试项目',
            'chain_name', '测试链路',
            'driver_name', '测试司机',
            'license_plate', '测试车牌',
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
    
    -- 调用preview_import_with_duplicates_check函数
    SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
    
    RAISE NOTICE '✅ preview_import_with_duplicates_check 测试成功';
    RAISE NOTICE '结果包含字段: %', jsonb_object_keys(result);
    
    -- 检查结果中是否包含平台字段
    IF result ? 'new_records' AND jsonb_array_length(result->'new_records') > 0 THEN
        RAISE NOTICE '✅ 新记录处理正常';
        
        IF result->'new_records'->0->'record' ? 'external_tracking_numbers' THEN
            RAISE NOTICE '✅ external_tracking_numbers 字段存在';
            RAISE NOTICE '   值: %', result->'new_records'->0->'record'->'external_tracking_numbers';
        ELSE
            RAISE NOTICE '❌ external_tracking_numbers 字段缺失';
        END IF;
        
        IF result->'new_records'->0->'record' ? 'other_platform_names' THEN
            RAISE NOTICE '✅ other_platform_names 字段存在';
            RAISE NOTICE '   值: %', result->'new_records'->0->'record'->'other_platform_names';
        ELSE
            RAISE NOTICE '❌ other_platform_names 字段缺失';
        END IF;
    ELSE
        RAISE NOTICE '❌ 没有新记录或记录格式错误';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ preview_import_with_duplicates_check 测试失败: %', SQLERRM;
END $$;

-- 4. 测试batch_import_logistics_records函数
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
    inserted_count integer;
BEGIN
    -- 创建包含平台字段的测试数据
    test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试项目',
            'chain_name', '测试链路',
            'driver_name', '测试司机导入',
            'license_plate', '测试车牌导入',
            'driver_phone', '13800138001',
            'loading_location', '北京仓库',
            'unloading_location', '上海仓库',
            'loading_date', '2025-01-21',
            'loading_weight', '30.0',
            'unloading_weight', '29.5',
            'current_cost', '1200',
            'extra_cost', '150',
            'transport_type', '实际运输',
            'remarks', '测试导入备注',
            'external_tracking_numbers', jsonb_build_array(
                jsonb_build_object(
                    'platform', '货拉拉',
                    'tracking_number', 'HL20250121001',
                    'status', 'pending',
                    'created_at', '2025-01-21T08:00:00Z'
                )
            ),
            'other_platform_names', ARRAY['货拉拉', '满帮']
        )
    );
    
    -- 调用batch_import_logistics_records函数
    SELECT public.batch_import_logistics_records(test_records) INTO result;
    
    RAISE NOTICE '✅ batch_import_logistics_records 测试成功';
    RAISE NOTICE '导入结果: %', result;
    
    -- 检查导入结果
    IF result ? 'success_count' THEN
        inserted_count := (result->>'success_count')::integer;
        RAISE NOTICE '✅ 成功导入 % 条记录', inserted_count;
    END IF;
    
    IF result ? 'error_count' THEN
        RAISE NOTICE '❌ 导入错误 % 条记录', (result->>'error_count')::integer;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ batch_import_logistics_records 测试失败: %', SQLERRM;
END $$;

-- 5. 验证导入的数据
SELECT 
    auto_number,
    project_name,
    driver_name,
    external_tracking_numbers,
    other_platform_names,
    created_at
FROM logistics_records 
WHERE driver_name = '测试司机导入'
   OR driver_name = '测试司机'
ORDER BY created_at DESC
LIMIT 5;

-- 6. 测试重复检测（平台字段不同但核心字段相同）
DO $$
DECLARE
    duplicate_test_records jsonb;
    result jsonb;
BEGIN
    -- 创建与现有记录核心字段相同但平台字段不同的测试数据
    duplicate_test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试项目',
            'chain_name', '测试链路',
            'driver_name', '测试司机',
            'license_plate', '测试车牌',
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
                    'platform', '运满满',
                    'tracking_number', 'YM20250120001',
                    'status', 'pending'
                )
            ),
            'other_platform_names', ARRAY['运满满']
        )
    );
    
    -- 调用preview_import_with_duplicates_check函数
    SELECT public.preview_import_with_duplicates_check(duplicate_test_records) INTO result;
    
    RAISE NOTICE '✅ 重复检测测试完成';
    
    -- 检查是否被识别为重复
    IF result ? 'duplicate_records' AND jsonb_array_length(result->'duplicate_records') > 0 THEN
        RAISE NOTICE '✅ 重复记录检测正常（平台字段不同但核心字段相同）';
        RAISE NOTICE '重复记录数: %', jsonb_array_length(result->'duplicate_records');
    ELSE
        RAISE NOTICE '❌ 重复记录检测异常';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ 重复检测测试失败: %', SQLERRM;
END $$;

-- 7. 清理测试数据
DELETE FROM logistics_records 
WHERE driver_name IN ('测试司机', '测试司机导入')
   OR project_name = '测试项目';

-- 8. 最终验证
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as has_external_tracking,
    COUNT(other_platform_names) as has_other_platform_names
FROM logistics_records;

-- 9. 测试完成提示
DO $$
BEGIN
    RAISE NOTICE '🎉 平台字段导入功能测试完成！';
    RAISE NOTICE '✅ 如果看到以上所有测试都成功，说明平台字段导入功能正常工作';
    RAISE NOTICE '✅ 如果看到任何❌标记，说明需要进一步检查相关功能';
END $$;
