-- 测试修正后的 external_tracking_numbers 字段格式
-- 验证数据格式：同一平台的多个运单号用|分隔，不同平台用数组位置对应

-- 1. 查看当前 external_tracking_numbers 的数据格式
SELECT 
    auto_number,
    external_tracking_numbers,
    jsonb_array_length(external_tracking_numbers) as array_length,
    external_tracking_numbers::text as json_text
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 2. 检查 external_tracking_numbers 的数组元素内容
SELECT 
    auto_number,
    jsonb_array_elements(external_tracking_numbers) as tracking_element,
    jsonb_typeof(jsonb_array_elements(external_tracking_numbers)) as element_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;

-- 3. 检查 other_platform_names 的数据格式
SELECT 
    auto_number,
    other_platform_names,
    array_length(other_platform_names, 1) as array_length
FROM logistics_records 
WHERE other_platform_names IS NOT NULL 
  AND array_length(other_platform_names, 1) > 0
ORDER BY created_at DESC
LIMIT 5;

-- 4. 验证数据关联：平台名称和运单号的对应关系
-- 期望格式：
-- other_platform_names: ["货拉拉", "运满满"]
-- external_tracking_numbers: ["2021615278|2021615821", "2021615822"]
SELECT 
    auto_number,
    other_platform_names,
    external_tracking_numbers,
    CASE 
        WHEN array_length(other_platform_names, 1) = jsonb_array_length(external_tracking_numbers) THEN '数量匹配'
        ELSE '数量不匹配'
    END as platform_tracking_match
FROM logistics_records 
WHERE other_platform_names IS NOT NULL 
  AND array_length(other_platform_names, 1) > 0
  AND external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;

-- 5. 测试查询功能：根据运单号查找记录（支持|分隔的运单号）
-- 查找包含特定运单号的记录
SELECT 
    auto_number,
    project_name,
    driver_name,
    other_platform_names,
    external_tracking_numbers
FROM logistics_records
WHERE EXISTS (
    SELECT 1 
    FROM jsonb_array_elements_text(external_tracking_numbers) as elem
    WHERE elem::text LIKE '%2021615278%'
)
LIMIT 5;

-- 6. 测试查询功能：根据平台名称查找记录
SELECT 
    auto_number,
    project_name,
    driver_name,
    other_platform_names,
    external_tracking_numbers
FROM logistics_records
WHERE '货拉拉' = ANY(other_platform_names)
LIMIT 5;

-- 7. 解析运单号：将|分隔的运单号展开
-- 这个查询展示如何解析每个平台的运单号
SELECT 
    auto_number,
    platform_index,
    platform_name,
    tracking_numbers,
    string_to_array(tracking_numbers::text, '|') as individual_tracking_numbers
FROM (
    SELECT 
        auto_number,
        platform_index,
        other_platform_names[platform_index] as platform_name,
        external_tracking_numbers[platform_index]::text as tracking_numbers
    FROM logistics_records,
         generate_series(1, array_length(other_platform_names, 1)) as platform_index
    WHERE other_platform_names IS NOT NULL 
      AND array_length(other_platform_names, 1) > 0
      AND external_tracking_numbers IS NOT NULL 
      AND external_tracking_numbers != '[]'::jsonb
) t
WHERE tracking_numbers IS NOT NULL
ORDER BY auto_number, platform_index
LIMIT 10;

-- 8. 统计 external_tracking_numbers 的数据类型分布
SELECT 
    CASE 
        WHEN external_tracking_numbers IS NULL THEN 'NULL'
        WHEN external_tracking_numbers = '[]'::jsonb THEN '空数组'
        WHEN external_tracking_numbers = 'null'::jsonb THEN 'null值'
        WHEN jsonb_typeof(external_tracking_numbers) = 'array' THEN 'JSONB数组'
        ELSE '其他类型'
    END as data_type,
    COUNT(*) as count
FROM logistics_records
GROUP BY 
    CASE 
        WHEN external_tracking_numbers IS NULL THEN 'NULL'
        WHEN external_tracking_numbers = '[]'::jsonb THEN '空数组'
        WHEN external_tracking_numbers = 'null'::jsonb THEN 'null值'
        WHEN jsonb_typeof(external_tracking_numbers) = 'array' THEN 'JSONB数组'
        ELSE '其他类型'
    END
ORDER BY count DESC;

-- 9. 验证导入后的数据格式示例
-- 期望的格式：
-- other_platform_names: ["可乐公司"]
-- external_tracking_numbers: ["2021615278|2021615821"]
SELECT 
    auto_number,
    other_platform_names,
    external_tracking_numbers,
    CASE 
        WHEN jsonb_typeof(external_tracking_numbers) = 'array' 
             AND EXISTS (
                 SELECT 1 
                 FROM jsonb_array_elements(external_tracking_numbers) as elem
                 WHERE jsonb_typeof(elem) = 'string'
             ) THEN '正确格式'
        ELSE '错误格式'
    END as format_check
FROM logistics_records
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;
