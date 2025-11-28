-- ============================================================================
-- 重算指定的运单合作方成本
-- 日期：2025-12-01
-- 说明：根据运单编号列表，删除并重新计算合作方成本
-- ============================================================================

DO $$
DECLARE
    v_waybill_numbers text[] := ARRAY[
        'YDN20251124-004',
        'YDN20251124-003',
        'YDN20251124-002',
        'YDN20251124-001',
        'YDN20251123-027',
        'YDN20251123-026',
        'YDN20251123-025',
        'YDN20251123-024',
        'YDN20251123-023'
    ];
    v_record_ids uuid[];
    v_deleted_count integer;
    v_recalc_result jsonb;
    v_waybill_number text;
    v_found_count integer := 0;
    v_not_found text[] := ARRAY[]::text[];
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始重算 % 个运单的合作方成本', array_length(v_waybill_numbers, 1);
    RAISE NOTICE '========================================';
    
    -- 步骤1：根据运单编号查找运单ID
    SELECT ARRAY_AGG(id) INTO v_record_ids
    FROM public.logistics_records
    WHERE auto_number = ANY(v_waybill_numbers);
    
    -- 检查哪些运单找到了，哪些没找到
    FOR v_waybill_number IN SELECT unnest(v_waybill_numbers)
    LOOP
        IF EXISTS (SELECT 1 FROM public.logistics_records WHERE auto_number = v_waybill_number) THEN
            v_found_count := v_found_count + 1;
        ELSE
            v_not_found := array_append(v_not_found, v_waybill_number);
        END IF;
    END LOOP;
    
    IF v_record_ids IS NULL OR array_length(v_record_ids, 1) IS NULL THEN
        RAISE EXCEPTION '未找到任何运单记录';
    END IF;
    
    RAISE NOTICE '找到 % 条运单记录', array_length(v_record_ids, 1);
    
    IF array_length(v_not_found, 1) > 0 THEN
        RAISE WARNING '以下运单未找到：%', array_to_string(v_not_found, ', ');
    END IF;
    
    -- 步骤2：删除这些运单的所有合作方成本记录（包括手工修改的）
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = ANY(v_record_ids);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE '已删除 % 条合作方成本记录', v_deleted_count;
    
    -- 步骤3：重新计算所有合作方成本
    SELECT public.batch_recalculate_partner_costs_1120(v_record_ids) INTO v_recalc_result;
    
    -- 步骤4：显示重算结果
    IF v_recalc_result IS NOT NULL THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '重算结果：';
        RAISE NOTICE '  成功：%', v_recalc_result->>'success';
        RAISE NOTICE '  消息：%', v_recalc_result->>'message';
        RAISE NOTICE '  总运单数：%', v_recalc_result->>'total_count';
        RAISE NOTICE '  成功数：%', v_recalc_result->>'updated_count';
        RAISE NOTICE '  跳过数：%', v_recalc_result->>'skipped_count';
        RAISE NOTICE '  保护手工值：%', v_recalc_result->>'protected_count';
        RAISE NOTICE '========================================';
        
        IF (v_recalc_result->>'success')::boolean = false THEN
            RAISE EXCEPTION '重算失败：%', v_recalc_result->>'message';
        END IF;
    ELSE
        RAISE EXCEPTION '重算函数返回空结果';
    END IF;
    
    RAISE NOTICE '✅ 重算完成！';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '重算失败：%', SQLERRM;
END $$;

