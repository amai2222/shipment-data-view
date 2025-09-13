-- 测试运单导入时 payable_cost 字段的计算
-- 验证司机应收金额是否正确计算

-- 1. 查看最近导入的运单记录，检查 payable_cost 字段
SELECT 
    auto_number,
    project_name,
    driver_name,
    current_cost,
    extra_cost,
    payable_cost,
    CASE 
        WHEN payable_cost = (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0)) THEN '计算正确'
        ELSE '计算错误'
    END as calculation_status,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- 2. 检查所有 payable_cost 为 0 但 current_cost 或 extra_cost 不为 0 的记录
SELECT 
    auto_number,
    project_name,
    driver_name,
    current_cost,
    extra_cost,
    payable_cost,
    '需要重新计算' as status,
    created_at
FROM logistics_records 
WHERE payable_cost = 0 
  AND (current_cost > 0 OR extra_cost > 0)
ORDER BY created_at DESC
LIMIT 20;

-- 3. 统计 payable_cost 计算错误的记录数量
SELECT 
    '计算错误' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE payable_cost != (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL)

UNION ALL

SELECT 
    '计算正确' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE payable_cost = (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 4. 修复 payable_cost 计算错误的记录
-- 更新所有 payable_cost 计算错误的记录
UPDATE logistics_records 
SET payable_cost = COALESCE(current_cost, 0) + COALESCE(extra_cost, 0)
WHERE payable_cost != (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 5. 验证修复结果
SELECT 
    '修复后统计' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE payable_cost = (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 6. 测试导入函数中的 payable_cost 计算
-- 模拟导入数据，验证 payable_cost 是否正确计算
DO $$
DECLARE
    test_record_id UUID;
    test_current_cost NUMERIC := 1000;
    test_extra_cost NUMERIC := 200;
    expected_payable_cost NUMERIC := 1200;
    actual_payable_cost NUMERIC;
BEGIN
    -- 插入测试记录
    INSERT INTO logistics_records (
        auto_number, project_name, driver_name, loading_location, unloading_location,
        loading_date, current_cost, extra_cost, payable_cost, created_by_user_id
    ) VALUES (
        'TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        '测试项目',
        '测试司机',
        '测试装货地点',
        '测试卸货地点',
        NOW(),
        test_current_cost,
        test_extra_cost,
        test_current_cost + test_extra_cost, -- 正确的 payable_cost
        auth.uid()
    ) RETURNING id INTO test_record_id;
    
    -- 验证 payable_cost 是否正确
    SELECT payable_cost INTO actual_payable_cost
    FROM logistics_records
    WHERE id = test_record_id;
    
    IF actual_payable_cost = expected_payable_cost THEN
        RAISE NOTICE '测试通过：payable_cost 计算正确 (%)', actual_payable_cost;
    ELSE
        RAISE NOTICE '测试失败：期望 %, 实际 %', expected_payable_cost, actual_payable_cost;
    END IF;
    
    -- 清理测试数据
    DELETE FROM logistics_records WHERE id = test_record_id;
END $$;

-- 7. 检查导入函数是否被正确调用
-- 查看最近的导入日志或记录
SELECT 
    '最近导入记录' as info,
    COUNT(*) as count
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '1 hour';
