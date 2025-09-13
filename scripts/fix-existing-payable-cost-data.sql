-- 修复现有数据中 payable_cost 计算错误的记录
-- 这个脚本将更新所有计算错误的 payable_cost 字段

-- 1. 查看需要修复的记录
SELECT 
    '需要修复的记录' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE payable_cost != (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 2. 修复 payable_cost 计算错误的记录
UPDATE logistics_records 
SET payable_cost = COALESCE(current_cost, 0) + COALESCE(extra_cost, 0)
WHERE payable_cost != (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 3. 验证修复结果
SELECT 
    '修复后统计' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE payable_cost = (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0))
  AND (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 4. 显示修复前后的对比
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
    END as calculation_status
FROM logistics_records 
WHERE (current_cost IS NOT NULL OR extra_cost IS NOT NULL)
ORDER BY created_at DESC
LIMIT 10;

-- 5. 验证 external_tracking_numbers 格式（修正后的查询）
SELECT 
    COUNT(*) as total_records,
    SUM(CASE WHEN EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(external_tracking_numbers) as elem
        WHERE jsonb_typeof(elem) = 'string'
    ) THEN 1 ELSE 0 END) as correct_format,
    SUM(CASE WHEN EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(external_tracking_numbers) as elem
        WHERE jsonb_typeof(elem) = 'object'
    ) THEN 1 ELSE 0 END) as incorrect_format
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb;
