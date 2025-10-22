-- ==========================================
-- 验证项目合作方自动重算功能
-- ==========================================
-- 用途：验证触发器和重算函数是否正常工作
-- 执行：在 Supabase SQL Editor 中执行
-- ==========================================

-- ============================================================
-- 1. 验证触发器是否创建成功
-- ============================================================
SELECT 
    '触发器检查' as "检查项",
    trigger_name as "触发器名称",
    event_manipulation as "触发事件",
    event_object_table as "监控表",
    action_timing as "触发时机"
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_recalc_partner_costs';

-- 预期结果：
-- trigger_name: trigger_auto_recalc_partner_costs
-- event_manipulation: INSERT, UPDATE, DELETE
-- event_object_table: project_partners
-- action_timing: AFTER

-- ============================================================
-- 2. 验证函数是否创建成功
-- ============================================================
SELECT 
    '重算函数检查' as "检查项",
    routine_name as "函数名"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
      'recalculate_costs_for_chain',
      'recalculate_costs_for_chain_safe',
      'recalculate_costs_for_project',
      'auto_recalc_on_project_partner_change'
  )
ORDER BY routine_name;

-- 预期结果：应该有4个函数

-- ============================================================
-- 3. 测试重算功能（模拟场景）
-- ============================================================

-- 准备测试数据：找一个有运单的项目
WITH test_project AS (
    SELECT 
        p.id as project_id,
        p.name as project_name,
        pc.id as chain_id,
        pc.chain_name,
        COUNT(lr.id) as total_records,
        COUNT(CASE WHEN lpc.payment_status = 'Paid' THEN 1 END) as paid_records,
        COUNT(CASE WHEN lpc.payment_status != 'Paid' THEN 1 END) as unpaid_records
    FROM projects p
    JOIN partner_chains pc ON p.id = pc.project_id
    JOIN logistics_records lr ON lr.project_id = p.id AND lr.chain_id = pc.id
    LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
    GROUP BY p.id, p.name, pc.id, pc.chain_name
    HAVING COUNT(lr.id) > 0
    LIMIT 1
)
SELECT 
    '测试项目信息' as "类型",
    project_name as "项目名称",
    chain_name as "链路名称",
    total_records as "总运单数",
    paid_records as "已付款运单",
    unpaid_records as "未付款运单"
FROM test_project;

-- ============================================================
-- 4. 测试安全重算函数
-- ============================================================

-- 注意：此查询只查看，不实际执行重算
-- 如需测试，取消下面的注释

/*
-- 使用第一个有运单的项目进行测试
WITH test_project AS (
    SELECT 
        p.id as project_id,
        pc.id as chain_id
    FROM projects p
    JOIN partner_chains pc ON p.id = pc.project_id
    JOIN logistics_records lr ON lr.project_id = p.id AND lr.chain_id = pc.id
    GROUP BY p.id, pc.id
    HAVING COUNT(lr.id) > 0
    LIMIT 1
)
SELECT recalculate_costs_for_chain_safe(
    test_project.project_id,
    test_project.chain_id,
    TRUE  -- 跳过已付款
)
FROM test_project;
*/

-- ============================================================
-- 5. 查看某个运单的成本记录变化
-- ============================================================

-- 找一个有成本记录的运单
WITH sample_record AS (
    SELECT lr.id, lr.auto_number
    FROM logistics_records lr
    JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
    LIMIT 1
)
SELECT 
    '示例运单成本记录' as "类型",
    lr.auto_number as "运单编号",
    p.name as "合作方",
    lpc.level as "级别",
    lpc.base_amount as "基础金额",
    lpc.payable_amount as "应付金额",
    lpc.payment_status as "付款状态",
    lpc.invoice_status as "开票状态",
    lpc.created_at as "创建时间"
FROM sample_record sr
JOIN logistics_records lr ON lr.id = sr.id
JOIN logistics_partner_costs lpc ON lpc.logistics_record_id = lr.id
JOIN partners p ON lpc.partner_id = p.id
ORDER BY lpc.level;

-- ============================================================
-- 6. 统计各项目的运单付款状态
-- ============================================================
SELECT 
    p.name as "项目名称",
    COUNT(DISTINCT lr.id) as "总运单数",
    COUNT(DISTINCT CASE WHEN lpc.payment_status = 'Paid' THEN lr.id END) as "已付款运单",
    COUNT(DISTINCT CASE WHEN lpc.payment_status != 'Paid' THEN lr.id END) as "未付款运单",
    ROUND(
        COUNT(DISTINCT CASE WHEN lpc.payment_status = 'Paid' THEN lr.id END) * 100.0 / 
        NULLIF(COUNT(DISTINCT lr.id), 0), 
        2
    ) as "已付款比例%"
FROM projects p
JOIN logistics_records lr ON lr.project_id = p.id
LEFT JOIN logistics_partner_costs lpc ON lpc.logistics_record_id = lr.id
GROUP BY p.name
HAVING COUNT(DISTINCT lr.id) > 0
ORDER BY COUNT(DISTINCT lr.id) DESC
LIMIT 10;

-- ============================================================
-- 7. 最终验证汇总
-- ============================================================
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
    v_func_count INTEGER;
BEGIN
    -- 检查触发器
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trigger_auto_recalc_partner_costs'
    ) INTO v_trigger_exists;
    
    -- 检查函数数量
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
          'recalculate_costs_for_chain',
          'recalculate_costs_for_chain_safe',
          'recalculate_costs_for_project',
          'auto_recalc_on_project_partner_change'
      );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '自动重算功能验证报告';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '触发器检查：';
    RAISE NOTICE '  trigger_auto_recalc_partner_costs: %', 
        CASE WHEN v_trigger_exists THEN '✅ 已创建' ELSE '❌ 不存在' END;
    RAISE NOTICE '';
    RAISE NOTICE '函数检查：';
    RAISE NOTICE '  应有函数：4个';
    RAISE NOTICE '  实际函数：%个', v_func_count;
    RAISE NOTICE '  状态：%', 
        CASE WHEN v_func_count = 4 THEN '✅ 完整' ELSE '❌ 缺失' END;
    RAISE NOTICE '';
    
    IF v_trigger_exists AND v_func_count = 4 THEN
        RAISE NOTICE '✅ 自动重算功能安装成功！';
        RAISE NOTICE '';
        RAISE NOTICE '功能特性：';
        RAISE NOTICE '  ✓ 修改项目合作方时自动重算';
        RAISE NOTICE '  ✓ 安全模式：跳过已付款运单';
        RAISE NOTICE '  ✓ 智能触发：只在必要时重算';
        RAISE NOTICE '  ✓ 只更新受影响的链路';
        RAISE NOTICE '';
        RAISE NOTICE '使用方式：';
        RAISE NOTICE '  • 自动：直接修改项目配置，系统自动处理';
        RAISE NOTICE '  • 手动：调用 recalculate_costs_for_project() 函数';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '❌ 安装不完整，请检查迁移文件';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

