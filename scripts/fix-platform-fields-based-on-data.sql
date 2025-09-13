-- 基于实际数据情况修复平台字段问题
-- 数据情况：865条记录有external_tracking_numbers，327条有other_platform_names

-- 1. 首先检查数据格式是否正确
DO $$
DECLARE
    external_tracking_count integer;
    other_platform_count integer;
    external_tracking_errors integer := 0;
    other_platform_errors integer := 0;
    rec RECORD;
BEGIN
    -- 检查external_tracking_numbers字段
    SELECT COUNT(*) INTO external_tracking_count 
    FROM logistics_records 
    WHERE external_tracking_numbers IS NOT NULL;
    
    RAISE NOTICE 'external_tracking_numbers 记录数: %', external_tracking_count;
    
    -- 检查other_platform_names字段
    SELECT COUNT(*) INTO other_platform_count 
    FROM logistics_records 
    WHERE other_platform_names IS NOT NULL;
    
    RAISE NOTICE 'other_platform_names 记录数: %', other_platform_count;
    
    -- 检查external_tracking_numbers格式错误
    FOR rec IN 
        SELECT auto_number, external_tracking_numbers
        FROM logistics_records 
        WHERE external_tracking_numbers IS NOT NULL
        LIMIT 20
    LOOP
        BEGIN
            PERFORM rec.external_tracking_numbers::jsonb;
        EXCEPTION WHEN OTHERS THEN
            external_tracking_errors := external_tracking_errors + 1;
            RAISE NOTICE '❌ % - external_tracking_numbers格式错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
    
    -- 检查other_platform_names格式错误
    FOR rec IN 
        SELECT auto_number, other_platform_names
        FROM logistics_records 
        WHERE other_platform_names IS NOT NULL
        LIMIT 20
    LOOP
        BEGIN
            IF rec.other_platform_names IS NOT NULL THEN
                PERFORM array_length(rec.other_platform_names, 1);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            other_platform_errors := other_platform_errors + 1;
            RAISE NOTICE '❌ % - other_platform_names格式错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'external_tracking_numbers 格式错误数: %', external_tracking_errors;
    RAISE NOTICE 'other_platform_names 格式错误数: %', other_platform_errors;
END $$;

-- 2. 如果发现格式错误，清理损坏的数据
-- 清理无效的external_tracking_numbers
UPDATE logistics_records 
SET external_tracking_numbers = NULL
WHERE external_tracking_numbers IS NOT NULL 
  AND NOT (external_tracking_numbers::text ~ '^\[.*\]$' OR external_tracking_numbers::text ~ '^\{.*\}$');

-- 清理无效的other_platform_names
UPDATE logistics_records 
SET other_platform_names = NULL
WHERE other_platform_names IS NOT NULL 
  AND NOT (other_platform_names::text ~ '^\{.*\}$');

-- 3. 验证清理结果
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as valid_external_tracking,
    COUNT(other_platform_names) as valid_other_platform_names
FROM logistics_records;

-- 4. 测试preview_import_with_duplicates_check函数
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
BEGIN
    -- 创建简单的测试记录
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
    
    -- 调用函数
    SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
    
    RAISE NOTICE '✅ preview_import_with_duplicates_check 测试成功';
    
    -- 检查结果
    IF result ? 'new_records' AND jsonb_array_length(result->'new_records') > 0 THEN
        RAISE NOTICE '✅ 新记录处理正常';
        
        IF result->'new_records'->0->'record' ? 'external_tracking_numbers' THEN
            RAISE NOTICE '✅ external_tracking_numbers 字段存在';
        ELSE
            RAISE NOTICE '❌ external_tracking_numbers 字段缺失';
        END IF;
        
        IF result->'new_records'->0->'record' ? 'other_platform_names' THEN
            RAISE NOTICE '✅ other_platform_names 字段存在';
        ELSE
            RAISE NOTICE '❌ other_platform_names 字段缺失';
        END IF;
    ELSE
        RAISE NOTICE '❌ 没有新记录或记录格式错误';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ 测试失败: %', SQLERRM;
END $$;

-- 5. 检查Excel导入功能是否正常工作
-- 查看最近是否有通过Excel导入的记录包含平台字段
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
    END as other_platform_status,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '3 days'
ORDER BY created_at DESC
LIMIT 10;
