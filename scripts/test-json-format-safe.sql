-- 安全的JSON格式测试脚本
-- 避免JSON格式错误，逐步测试各个组件

-- 1. 检查数据库函数是否存在
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN (
    'preview_import_with_duplicates_check',
    'batch_import_logistics_records'
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

-- 3. 测试简单的JSON格式
DO $$
DECLARE
    simple_json jsonb;
    simple_array text[];
BEGIN
    -- 测试简单的JSON对象
    simple_json := '{"test": "value"}'::jsonb;
    RAISE NOTICE '✅ 简单JSON测试通过: %', simple_json;
    
    -- 测试简单的数组
    simple_array := ARRAY['item1', 'item2', 'item3'];
    RAISE NOTICE '✅ 简单数组测试通过: %', simple_array;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ 简单JSON测试失败: %', SQLERRM;
END $$;

-- 4. 测试平台字段的JSON格式
DO $$
DECLARE
    platform_json jsonb;
    platform_names text[];
BEGIN
    -- 测试平台运单号JSON格式
    platform_json := '[
        {
            "platform": "货拉拉",
            "tracking_number": "HL20250120001",
            "status": "pending"
        }
    ]'::jsonb;
    
    RAISE NOTICE '✅ 平台运单号JSON测试通过: %', platform_json;
    
    -- 测试平台名称数组格式
    platform_names := ARRAY['货拉拉', '满帮'];
    
    RAISE NOTICE '✅ 平台名称数组测试通过: %', platform_names;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ 平台字段JSON测试失败: %', SQLERRM;
END $$;

-- 5. 测试preview_import_with_duplicates_check函数（使用简单数据）
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    -- 构建简单的测试记录，避免复杂的JSON
    test_records := '[
        {
            "project_name": "测试项目",
            "chain_name": "测试链路",
            "driver_name": "测试司机",
            "license_plate": "测试车牌",
            "driver_phone": "13800138000",
            "loading_location": "北京仓库",
            "unloading_location": "上海仓库",
            "loading_date": "2025-01-20",
            "loading_weight": "25.5",
            "unloading_weight": "25.0",
            "current_cost": "1000",
            "extra_cost": "100",
            "transport_type": "实际运输",
            "remarks": "测试备注"
        }
    ]'::jsonb;
    
    -- 调用preview_import_with_duplicates_check函数
    SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
    
    -- 输出结果
    RAISE NOTICE 'Preview result: %', result;
    
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
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ preview_import_with_duplicates_check 测试失败: %', SQLERRM;
END $$;

-- 6. 检查最近的导入记录
SELECT 
    auto_number,
    project_name,
    driver_name,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 5;

-- 7. 检查是否有任何记录包含平台字段
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as has_external_tracking,
    COUNT(other_platform_names) as has_other_platform_names
FROM logistics_records;
