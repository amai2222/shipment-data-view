-- ============================================================================
-- 测试手动修改保护功能
-- ============================================================================
-- 功能：验证成本重算时正确跳过手动修改的最高级合作方
-- ============================================================================

BEGIN;

-- ============================================================================
-- 测试场景1：手动修改后修改链路
-- ============================================================================

DO $$
DECLARE
    v_test_record_id UUID;
    v_test_project_id UUID;
    v_chain_a_id UUID;
    v_chain_b_id UUID;
    v_result JSON;
    v_amount_before NUMERIC;
    v_amount_after NUMERIC;
    v_is_manual_before BOOLEAN;
    v_is_manual_after BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '测试场景1：手动修改后修改链路';
    RAISE NOTICE '========================================';
    
    -- 找一个测试项目和运单
    SELECT id INTO v_test_project_id FROM projects LIMIT 1;
    SELECT id INTO v_test_record_id FROM logistics_records 
    WHERE project_id = v_test_project_id AND payment_status = 'Unpaid' 
    LIMIT 1;
    
    IF v_test_record_id IS NULL THEN
        RAISE NOTICE '❌ 未找到测试运单';
        RETURN;
    END IF;
    
    -- 查找该项目的两个链路
    SELECT id INTO v_chain_a_id FROM partner_chains 
    WHERE project_id = v_test_project_id LIMIT 1;
    
    SELECT id INTO v_chain_b_id FROM partner_chains 
    WHERE project_id = v_test_project_id AND id != v_chain_a_id LIMIT 1;
    
    IF v_chain_b_id IS NULL THEN
        RAISE NOTICE '❌ 该项目只有一个链路，无法测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '测试运单ID: %', v_test_record_id;
    
    -- 步骤1：获取最高级合作方的原始金额
    SELECT payable_amount, is_manually_modified
    INTO v_amount_before, v_is_manual_before
    FROM logistics_partner_costs
    WHERE logistics_record_id = v_test_record_id
    ORDER BY level DESC
    LIMIT 1;
    
    RAISE NOTICE '原始最高级应收: % (is_manually_modified=%)', v_amount_before, v_is_manual_before;
    
    -- 步骤2：手动修改最高级合作方应收
    UPDATE logistics_partner_costs
    SET payable_amount = v_amount_before + 200,  -- 增加200元
        is_manually_modified = TRUE
    WHERE logistics_record_id = v_test_record_id
      AND level = (SELECT MAX(level) FROM logistics_partner_costs WHERE logistics_record_id = v_test_record_id);
    
    RAISE NOTICE '手动修改应收为: %', v_amount_before + 200;
    
    -- 步骤3：修改合作链路（触发成本重算）
    SELECT modify_logistics_record_chain_with_recalc(
        v_test_record_id,
        (SELECT chain_name FROM partner_chains WHERE id = v_chain_b_id)
    ) INTO v_result;
    
    RAISE NOTICE '链路修改结果: %', v_result;
    
    -- 步骤4：检查最高级合作方的金额是否被保留
    SELECT payable_amount, is_manually_modified
    INTO v_amount_after, v_is_manual_after
    FROM logistics_partner_costs
    WHERE logistics_record_id = v_test_record_id
    ORDER BY level DESC
    LIMIT 1;
    
    RAISE NOTICE '重算后最高级应收: % (is_manually_modified=%)', v_amount_after, v_is_manual_after;
    
    -- 验证结果
    IF v_amount_after = v_amount_before + 200 AND v_is_manual_after = TRUE THEN
        RAISE NOTICE '✅ 测试通过：手动修改的值被正确保留';
    ELSE
        RAISE NOTICE '❌ 测试失败：手动修改的值未被保留';
        RAISE NOTICE '   期望: % (手动修改)', v_amount_before + 200;
        RAISE NOTICE '   实际: % (is_manual=%)', v_amount_after, v_is_manual_after;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 测试场景2：未手动修改时正常重算
-- ============================================================================

DO $$
DECLARE
    v_test_record_id UUID;
    v_test_project_id UUID;
    v_amount_before NUMERIC;
    v_amount_after NUMERIC;
    v_is_manual_after BOOLEAN;
    v_result JSON;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '测试场景2：未手动修改时正常重算';
    RAISE NOTICE '========================================';
    
    -- 找一个未手动修改的运单
    SELECT lr.id, lr.project_id
    INTO v_test_record_id, v_test_project_id
    FROM logistics_records lr
    WHERE lr.payment_status = 'Unpaid'
      AND NOT EXISTS (
          SELECT 1 FROM logistics_partner_costs lpc
          WHERE lpc.logistics_record_id = lr.id
            AND lpc.is_manually_modified = TRUE
      )
    LIMIT 1;
    
    IF v_test_record_id IS NULL THEN
        RAISE NOTICE '❌ 未找到测试运单';
        RETURN;
    END IF;
    
    RAISE NOTICE '测试运单ID: %', v_test_record_id;
    
    -- 获取原始金额
    SELECT payable_amount
    INTO v_amount_before
    FROM logistics_partner_costs
    WHERE logistics_record_id = v_test_record_id
    ORDER BY level DESC
    LIMIT 1;
    
    RAISE NOTICE '原始最高级应收: %', v_amount_before;
    
    -- 触发重算
    SELECT recalculate_costs_for_chain(
        v_test_project_id,
        (SELECT chain_id FROM logistics_records WHERE id = v_test_record_id)
    ) INTO v_result;
    
    -- 检查重算后的值
    SELECT payable_amount, COALESCE(is_manually_modified, FALSE)
    INTO v_amount_after, v_is_manual_after
    FROM logistics_partner_costs
    WHERE logistics_record_id = v_test_record_id
    ORDER BY level DESC
    LIMIT 1;
    
    RAISE NOTICE '重算后最高级应收: % (is_manually_modified=%)', v_amount_after, v_is_manual_after;
    
    -- 验证：应该重新计算，is_manually_modified应该是FALSE
    IF v_is_manual_after = FALSE THEN
        RAISE NOTICE '✅ 测试通过：未手动修改的运单正常重算';
    ELSE
        RAISE NOTICE '❌ 测试失败：is_manually_modified 应该为 FALSE';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 测试场景3：检查 is_manually_modified 字段是否存在
-- ============================================================================

DO $$
DECLARE
    v_column_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '测试场景3：字段存在性检查';
    RAISE NOTICE '========================================';
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'logistics_partner_costs' 
          AND column_name = 'is_manually_modified'
    ) INTO v_column_exists;
    
    IF v_column_exists THEN
        RAISE NOTICE '✅ is_manually_modified 字段已存在';
        
        -- 显示字段详情
        SELECT 
            column_name,
            data_type,
            column_default,
            is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'logistics_partner_costs' 
          AND column_name = 'is_manually_modified';
    ELSE
        RAISE NOTICE '❌ is_manually_modified 字段不存在';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 测试场景4：统计手动修改的记录
-- ============================================================================

SELECT 
    '手动修改统计' as 测试名称,
    COUNT(*) as 总记录数,
    COUNT(*) FILTER (WHERE is_manually_modified = TRUE) as 手动修改记录数,
    COUNT(*) FILTER (WHERE is_manually_modified = FALSE OR is_manually_modified IS NULL) as 系统计算记录数
FROM logistics_partner_costs;

ROLLBACK;  -- 测试完成后回滚，不影响实际数据

-- ============================================================================
-- 使用说明
-- ============================================================================
-- 
-- 1. 执行此脚本进行测试（使用ROLLBACK不会影响数据）
-- 2. 查看测试结果
-- 3. 如果测试通过，执行实际的实施脚本
--
-- ============================================================================

