-- ============================================================================
-- 修复"鸡蛋运输"项目的合作方成本
-- 日期：2025-12-01
-- 说明：删除该项目所有运单的合作方成本，然后重新计算
-- ============================================================================

DO $$
DECLARE
    v_project_id uuid;
    v_project_name text := '鸡蛋运输';
    v_record_ids uuid[];
    v_deleted_count integer;
    v_recalc_result jsonb;
BEGIN
    -- 步骤1：查找项目ID
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE name = v_project_name;
    
    IF v_project_id IS NULL THEN
        RAISE EXCEPTION '未找到项目：%', v_project_name;
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '找到项目：% (ID: %)', v_project_name, v_project_id;
    RAISE NOTICE '========================================';
    
    -- 步骤2：获取该项目下所有运单的ID
    SELECT ARRAY_AGG(id) INTO v_record_ids
    FROM public.logistics_records
    WHERE project_id = v_project_id;
    
    IF v_record_ids IS NULL OR array_length(v_record_ids, 1) IS NULL THEN
        RAISE NOTICE '项目 "%" 下没有运单记录', v_project_name;
        RETURN;
    END IF;
    
    RAISE NOTICE '找到 % 条运单记录', array_length(v_record_ids, 1);
    
    -- 步骤3：删除所有合作方成本记录（包括手工修改的）
    DELETE FROM public.logistics_partner_costs
    WHERE logistics_record_id = ANY(v_record_ids);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE '已删除 % 条合作方成本记录', v_deleted_count;
    
    -- 步骤4：重新计算所有合作方成本
    SELECT public.batch_recalculate_partner_costs_1120(v_record_ids) INTO v_recalc_result;
    
    -- 步骤5：显示重算结果
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
    
    RAISE NOTICE '✅ 修复完成！';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '修复失败：%', SQLERRM;
END $$;

