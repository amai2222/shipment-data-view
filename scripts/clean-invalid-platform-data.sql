-- 清理无效的平台字段数据
-- 基于分析：external_tracking_numbers字段被错误填充，需要清理

-- 1. 先查看需要清理的数据
SELECT 
    '需要清理的记录' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND (external_tracking_numbers = '[]'::jsonb 
       OR external_tracking_numbers = '{}'::jsonb 
       OR external_tracking_numbers = 'null'::jsonb
       OR jsonb_typeof(external_tracking_numbers) != 'array'
       OR jsonb_array_length(external_tracking_numbers) = 0);

-- 2. 清理无效的external_tracking_numbers数据
UPDATE logistics_records 
SET external_tracking_numbers = NULL
WHERE external_tracking_numbers IS NOT NULL 
  AND (external_tracking_numbers = '[]'::jsonb 
       OR external_tracking_numbers = '{}'::jsonb 
       OR external_tracking_numbers = 'null'::jsonb
       OR jsonb_typeof(external_tracking_numbers) != 'array'
       OR jsonb_array_length(external_tracking_numbers) = 0);

-- 3. 验证清理结果
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as has_external_tracking,
    COUNT(other_platform_names) as has_other_platform_names
FROM logistics_records;

-- 4. 检查清理后的数据分布
SELECT 
    '清理后external_tracking_numbers分布' as description,
    COUNT(*) as total_records,
    COUNT(CASE WHEN external_tracking_numbers IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN external_tracking_numbers IS NOT NULL THEN 1 END) as not_null_count
FROM logistics_records;

-- 5. 测试Excel导入功能
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    -- 创建包含平台字段的测试记录
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
                    "status": "pending"
                }
            ],
            "other_platform_names": ["货拉拉", "满帮"]
        }
    ]'::jsonb;
    
    -- 调用preview_import_with_duplicates_check函数
    SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
    
    RAISE NOTICE '✅ Excel导入测试成功';
    
    -- 检查结果
    IF result ? 'new_records' AND jsonb_array_length(result->'new_records') > 0 THEN
        RAISE NOTICE '✅ 新记录处理正常';
        
        -- 检查平台字段
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
    RAISE NOTICE '❌ Excel导入测试失败: %', SQLERRM;
END $$;

-- 6. 检查清理后的有效数据
SELECT 
    auto_number,
    project_name,
    external_tracking_numbers,
    other_platform_names,
    created_at
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
   OR other_platform_names IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
