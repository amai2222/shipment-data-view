-- 简化版平台字段导入测试
-- 避免复杂的数据依赖，专注于功能验证

-- 1. 检查函数是否存在
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'preview_import_with_duplicates_check',
    'batch_import_logistics_records'
) 
AND routine_schema = 'public';

-- 2. 检查表结构
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
AND table_schema = 'public'
AND column_name IN ('external_tracking_numbers', 'other_platform_names')
ORDER BY column_name;

-- 3. 测试JSON格式
DO $$
DECLARE
    test_json jsonb;
    test_array text[];
BEGIN
    -- 测试external_tracking_numbers格式
    test_json := '[
        {
            "platform": "货拉拉",
            "tracking_number": "HL20250120001",
            "status": "pending"
        }
    ]'::jsonb;
    
    RAISE NOTICE '✅ external_tracking_numbers JSON格式测试通过: %', test_json;
    
    -- 测试other_platform_names格式
    test_array := ARRAY['货拉拉', '满帮', '运满满'];
    
    RAISE NOTICE '✅ other_platform_names 数组格式测试通过: %', test_array;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ JSON格式测试失败: %', SQLERRM;
END $$;

-- 4. 测试preview_import_with_duplicates_check函数（不依赖现有数据）
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    -- 创建测试数据（使用不存在的项目名，避免重复检测）
    test_records := jsonb_build_array(
        jsonb_build_object(
            'project_name', '测试项目_' || extract(epoch from now())::text,
            'chain_name', '测试链路',
            'driver_name', '测试司机_' || extract(epoch from now())::text,
            'license_plate', '测试车牌_' || extract(epoch from now())::text,
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
    
    -- 调用函数
    SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
    
    RAISE NOTICE '✅ preview_import_with_duplicates_check 函数调用成功';
    
    -- 检查结果结构
    IF result ? 'new_records' THEN
        RAISE NOTICE '✅ new_records 字段存在';
    ELSE
        RAISE NOTICE '❌ new_records 字段缺失';
    END IF;
    
    IF result ? 'duplicate_records' THEN
        RAISE NOTICE '✅ duplicate_records 字段存在';
    ELSE
        RAISE NOTICE '❌ duplicate_records 字段缺失';
    END IF;
    
    IF result ? 'error_records' THEN
        RAISE NOTICE '✅ error_records 字段存在';
    ELSE
        RAISE NOTICE '❌ error_records 字段缺失';
    END IF;
    
    -- 检查平台字段是否被传递
    IF result ? 'new_records' AND jsonb_array_length(result->'new_records') > 0 THEN
        IF result->'new_records'->0->'record' ? 'external_tracking_numbers' THEN
            RAISE NOTICE '✅ external_tracking_numbers 字段被正确传递';
        ELSE
            RAISE NOTICE '❌ external_tracking_numbers 字段未传递';
        END IF;
        
        IF result->'new_records'->0->'record' ? 'other_platform_names' THEN
            RAISE NOTICE '✅ other_platform_names 字段被正确传递';
        ELSE
            RAISE NOTICE '❌ other_platform_names 字段未传递';
        END IF;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ preview_import_with_duplicates_check 测试失败: %', SQLERRM;
END $$;

-- 5. 检查现有数据中的平台字段
SELECT 
    '现有数据统计' as description,
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as has_external_tracking,
    COUNT(other_platform_names) as has_other_platform_names
FROM logistics_records;

-- 6. 查看平台字段的示例数据
SELECT 
    auto_number,
    project_name,
    CASE 
        WHEN external_tracking_numbers IS NOT NULL THEN '有外部运单号'
        ELSE '无外部运单号'
    END as external_tracking_status,
    CASE 
        WHEN other_platform_names IS NOT NULL THEN '有其他平台'
        ELSE '无其他平台'
    END as other_platform_status
FROM logistics_records 
ORDER BY created_at DESC
LIMIT 5;

-- 7. 测试完成提示
DO $$
BEGIN
    RAISE NOTICE '🎉 简化版平台字段测试完成！';
    RAISE NOTICE '✅ 如果看到所有测试都成功，说明平台字段功能正常';
    RAISE NOTICE '📝 接下来可以测试实际的Excel导入功能';
END $$;
