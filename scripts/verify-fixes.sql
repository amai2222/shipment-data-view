-- 简化的验证脚本 - 避免 CASE/WHEN 中的集合函数错误
-- 验证 payable_cost 和 external_tracking_numbers 字段的修复结果

-- 1. 验证 payable_cost 计算是否正确
SELECT 
    'payable_cost 验证' as check_type,
    COUNT(*) as total_records,
    SUM(CASE WHEN payable_cost = (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0)) THEN 1 ELSE 0 END) as correct_calculations,
    SUM(CASE WHEN payable_cost != (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0)) THEN 1 ELSE 0 END) as incorrect_calculations
FROM logistics_records 
WHERE (current_cost IS NOT NULL OR extra_cost IS NOT NULL);

-- 2. 验证 external_tracking_numbers 格式
-- 使用子查询避免 CASE/WHEN 中的集合函数问题
WITH format_check AS (
    SELECT 
        id,
        external_tracking_numbers,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(external_tracking_numbers) as elem
                WHERE jsonb_typeof(elem) = 'string'
            ) THEN 'string'
            WHEN EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(external_tracking_numbers) as elem
                WHERE jsonb_typeof(elem) = 'object'
            ) THEN 'object'
            ELSE 'other'
        END as element_type
    FROM logistics_records 
    WHERE external_tracking_numbers IS NOT NULL 
      AND external_tracking_numbers != '[]'::jsonb
)
SELECT 
    'external_tracking_numbers 验证' as check_type,
    COUNT(*) as total_records,
    SUM(CASE WHEN element_type = 'string' THEN 1 ELSE 0 END) as correct_format,
    SUM(CASE WHEN element_type = 'object' THEN 1 ELSE 0 END) as incorrect_format,
    SUM(CASE WHEN element_type = 'other' THEN 1 ELSE 0 END) as other_format
FROM format_check;

-- 3. 显示最近的记录示例
SELECT 
    '最近记录示例' as info,
    auto_number,
    project_name,
    driver_name,
    current_cost,
    extra_cost,
    payable_cost,
    CASE 
        WHEN payable_cost = (COALESCE(current_cost, 0) + COALESCE(extra_cost, 0)) THEN '✓ 正确'
        ELSE '✗ 错误'
    END as payable_status,
    external_tracking_numbers,
    other_platform_names
FROM logistics_records 
WHERE (current_cost IS NOT NULL OR extra_cost IS NOT NULL)
ORDER BY created_at DESC
LIMIT 5;

-- 4. 检查 external_tracking_numbers 的具体内容
SELECT 
    'external_tracking_numbers 内容检查' as info,
    auto_number,
    external_tracking_numbers,
    jsonb_array_length(external_tracking_numbers) as array_length
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 5. 检查运单号解析是否正确
SELECT 
    '运单号解析检查' as info,
    auto_number,
    other_platform_names,
    external_tracking_numbers,
    jsonb_array_elements(external_tracking_numbers) as tracking_element
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
  AND other_platform_names IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
