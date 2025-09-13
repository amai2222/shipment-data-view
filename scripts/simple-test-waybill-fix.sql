-- 简单测试运单编辑和导入平台字段修复
DO $$
DECLARE
    result jsonb;
    record_count integer;
BEGIN
    RAISE NOTICE '=== 简单测试运单编辑和导入平台字段修复 ===';
    
    -- 测试1: 检查运单查询函数
    BEGIN
        result := public.get_logistics_summary_and_records();
        record_count := (result->>'totalCount')::integer;
        RAISE NOTICE '✓ 运单查询函数正常，记录数: %', record_count;
        
        -- 检查是否包含平台字段
        IF result ? 'records' AND jsonb_array_length(result->'records') > 0 THEN
            IF (result->'records'->0) ? 'external_tracking_numbers' THEN
                RAISE NOTICE '✓ 包含 external_tracking_numbers 字段';
            ELSE
                RAISE NOTICE '✗ 缺少 external_tracking_numbers 字段';
            END IF;
            
            IF (result->'records'->0) ? 'other_platform_names' THEN
                RAISE NOTICE '✓ 包含 other_platform_names 字段';
            ELSE
                RAISE NOTICE '✗ 缺少 other_platform_names 字段';
            END IF;
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 运单查询函数测试失败: %', SQLERRM;
    END;
    
    -- 测试2: 检查导入函数是否存在
    BEGIN
        IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'import_logistics_data') THEN
            RAISE NOTICE '✓ import_logistics_data 函数存在';
        ELSE
            RAISE NOTICE '✗ import_logistics_data 函数不存在';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 导入函数检查失败: %', SQLERRM;
    END;
    
    -- 测试3: 检查数据库表结构
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 表结构检查失败: %', SQLERRM;
    END;
    
    RAISE NOTICE '=== 测试完成 ===';
    
END $$;
