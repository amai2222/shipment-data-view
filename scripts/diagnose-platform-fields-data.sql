-- 诊断平台字段数据问题
-- 基于查询结果：865条记录有external_tracking_numbers，327条有other_platform_names

-- 1. 检查external_tracking_numbers字段的数据类型和示例
SELECT 
    'external_tracking_numbers' as field_name,
    (SELECT pg_typeof(external_tracking_numbers) FROM logistics_records WHERE external_tracking_numbers IS NOT NULL LIMIT 1) as data_type,
    COUNT(*) as record_count,
    COUNT(CASE WHEN external_tracking_numbers IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN external_tracking_numbers IS NOT NULL THEN 1 END) as not_null_count
FROM logistics_records;

-- 2. 检查other_platform_names字段的数据类型和示例
SELECT 
    'other_platform_names' as field_name,
    (SELECT pg_typeof(other_platform_names) FROM logistics_records WHERE other_platform_names IS NOT NULL LIMIT 1) as data_type,
    COUNT(*) as record_count,
    COUNT(CASE WHEN other_platform_names IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN other_platform_names IS NOT NULL THEN 1 END) as not_null_count
FROM logistics_records;

-- 3. 查看external_tracking_numbers的示例数据
SELECT 
    auto_number,
    external_tracking_numbers,
    LENGTH(external_tracking_numbers::text) as json_length
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 4. 查看other_platform_names的示例数据
SELECT 
    auto_number,
    other_platform_names,
    array_length(other_platform_names, 1) as array_length
FROM logistics_records 
WHERE other_platform_names IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 5. 检查是否有格式错误的JSON数据
DO $$
DECLARE
    rec RECORD;
    error_count integer := 0;
    total_count integer := 0;
BEGIN
    FOR rec IN 
        SELECT auto_number, external_tracking_numbers
        FROM logistics_records 
        WHERE external_tracking_numbers IS NOT NULL
        LIMIT 10
    LOOP
        total_count := total_count + 1;
        BEGIN
            -- 尝试将external_tracking_numbers转换为jsonb
            PERFORM rec.external_tracking_numbers::jsonb;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '❌ % - external_tracking_numbers格式错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '检查了 % 条记录，发现 % 条格式错误', total_count, error_count;
END $$;

-- 6. 检查other_platform_names的数据格式
DO $$
DECLARE
    rec RECORD;
    error_count integer := 0;
    total_count integer := 0;
BEGIN
    FOR rec IN 
        SELECT auto_number, other_platform_names
        FROM logistics_records 
        WHERE other_platform_names IS NOT NULL
        LIMIT 10
    LOOP
        total_count := total_count + 1;
        BEGIN
            -- 检查other_platform_names是否为有效的文本数组
            IF rec.other_platform_names IS NOT NULL THEN
                PERFORM array_length(rec.other_platform_names, 1);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '❌ % - other_platform_names格式错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '检查了 % 条记录，发现 % 条格式错误', total_count, error_count;
END $$;

-- 7. 测试preview_import_with_duplicates_check函数是否能处理现有数据
DO $$
DECLARE
    test_records jsonb;
    result jsonb;
    sample_record record;
BEGIN
    -- 获取一条有平台字段的示例记录
    SELECT 
        jsonb_build_object(
            'project_name', project_name,
            'chain_name', chain_name,
            'driver_name', driver_name,
            'license_plate', license_plate,
            'driver_phone', driver_phone,
            'loading_location', loading_location,
            'unloading_location', unloading_location,
            'loading_date', loading_date,
            'loading_weight', loading_weight,
            'unloading_weight', unloading_weight,
            'current_cost', current_cost,
            'extra_cost', extra_cost,
            'transport_type', transport_type,
            'remarks', remarks,
            'external_tracking_numbers', external_tracking_numbers,
            'other_platform_names', other_platform_names
        ) as record_data
    INTO sample_record
    FROM logistics_records 
    WHERE external_tracking_numbers IS NOT NULL 
       OR other_platform_names IS NOT NULL
    LIMIT 1;
    
    IF sample_record.record_data IS NOT NULL THEN
        test_records := jsonb_build_array(sample_record.record_data);
        
        -- 调用preview_import_with_duplicates_check函数
        SELECT public.preview_import_with_duplicates_check(test_records) INTO result;
        
        RAISE NOTICE '✅ preview_import_with_duplicates_check 测试成功';
        RAISE NOTICE '结果包含字段: %', jsonb_object_keys(result);
        
        -- 检查结果中是否包含平台字段
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
        RAISE NOTICE '❌ 没有找到包含平台字段的示例记录';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ preview_import_with_duplicates_check 测试失败: %', SQLERRM;
END $$;

-- 8. 检查最近导入的记录是否包含平台字段
SELECT 
    auto_number,
    project_name,
    external_tracking_numbers IS NOT NULL as has_external_tracking,
    other_platform_names IS NOT NULL as has_other_platform_names,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;
