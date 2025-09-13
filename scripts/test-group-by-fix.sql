-- 测试 GROUP BY 错误修复
DO $$
DECLARE
    result jsonb;
    record_count integer;
BEGIN
    RAISE NOTICE '=== 测试 GROUP BY 错误修复 ===';
    
    -- 测试1: 基本查询
    BEGIN
        result := public.get_logistics_summary_and_records();
        record_count := (result->>'totalCount')::integer;
        RAISE NOTICE '✓ 基本查询成功，记录数: %', record_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 基本查询失败: %', SQLERRM;
        RETURN;
    END;
    
    -- 测试2: 带筛选条件查询
    BEGIN
        result := public.get_logistics_summary_and_records(
            p_start_date => '2024-01-01',
            p_end_date => '2024-12-31',
            p_page_number => 1,
            p_page_size => 10
        );
        RAISE NOTICE '✓ 筛选查询成功';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 筛选查询失败: %', SQLERRM;
    END;
    
    -- 测试3: 检查返回结构
    BEGIN
        result := public.get_logistics_summary_and_records();
        
        IF result ? 'records' THEN
            RAISE NOTICE '✓ 包含 records 字段';
        ELSE
            RAISE NOTICE '✗ 缺少 records 字段';
        END IF;
        
        IF result ? 'summary' THEN
            RAISE NOTICE '✓ 包含 summary 字段';
        ELSE
            RAISE NOTICE '✗ 缺少 summary 字段';
        END IF;
        
        IF result ? 'totalCount' THEN
            RAISE NOTICE '✓ 包含 totalCount 字段';
        ELSE
            RAISE NOTICE '✗ 缺少 totalCount 字段';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ 结构检查失败: %', SQLERRM;
    END;
    
    RAISE NOTICE '=== 测试完成 ===';
    
END $$;
