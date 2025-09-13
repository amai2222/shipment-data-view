-- 测试Excel导入平台字段功能
-- 用于调试为什么平台字段没有从Excel导入到数据库

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

-- 2. 检查logistics_records表结构，确认平台字段存在
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
-- 创建测试数据，包含平台字段
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    -- 构建测试记录，包含平台字段
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
            "remarks": "测试备注",
            "external_tracking_numbers": [
                {
                    "platform": "货拉拉",
                    "tracking_number": "HL20250120001",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                },
                {
                    "platform": "满帮",
                    "tracking_number": "MB20250120001",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                }
            ],
            "other_platform_names": ["货拉拉", "满帮", "运满满"]
        }
    ]'::jsonb;
    
    -- 调用preview_import_with_duplicates_check函数
    SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
    
    -- 输出结果
    RAISE NOTICE 'Preview result: %', result;
    
    -- 检查结果中是否包含平台字段
    IF result->'new_records'->0->'record' ? 'external_tracking_numbers' THEN
        RAISE NOTICE '✅ external_tracking_numbers 字段存在';
        RAISE NOTICE 'external_tracking_numbers 值: %', result->'new_records'->0->'record'->'external_tracking_numbers';
    ELSE
        RAISE NOTICE '❌ external_tracking_numbers 字段缺失';
    END IF;
    
    IF result->'new_records'->0->'record' ? 'other_platform_names' THEN
        RAISE NOTICE '✅ other_platform_names 字段存在';
        RAISE NOTICE 'other_platform_names 值: %', result->'new_records'->0->'record'->'other_platform_names';
    ELSE
        RAISE NOTICE '❌ other_platform_names 字段缺失';
    END IF;
    
END $$;

-- 4. 检查最近的导入记录，看是否包含平台字段
SELECT 
    auto_number,
    project_name,
    driver_name,
    external_tracking_numbers,
    other_platform_names,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 5;

-- 5. 检查是否有任何记录包含平台字段
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as has_external_tracking,
    COUNT(other_platform_names) as has_other_platform_names
FROM logistics_records;

-- 6. 检查平台字段的数据类型和示例值
SELECT 
    auto_number,
    external_tracking_numbers,
    other_platform_names,
    pg_typeof(external_tracking_numbers) as external_tracking_type,
    pg_typeof(other_platform_names) as other_platform_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
   OR other_platform_names IS NOT NULL
LIMIT 3;
