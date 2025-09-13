-- 修复 external_tracking_numbers 字段格式问题
-- 将复杂的JSONB对象转换为简单的TEXT[]数组

-- 1. 查看当前数据格式
SELECT 
    auto_number,
    external_tracking_numbers,
    jsonb_typeof(external_tracking_numbers) as data_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 2. 修复数据格式：将JSONB对象转换为TEXT[]数组
UPDATE logistics_records 
SET external_tracking_numbers = (
    SELECT jsonb_agg(
        CASE 
            -- 如果元素是对象，提取tracking_number字段
            WHEN jsonb_typeof(elem) = 'object' THEN elem->>'tracking_number'
            -- 如果元素已经是字符串，直接使用
            WHEN jsonb_typeof(elem) = 'string' THEN elem
            -- 其他情况转换为字符串
            ELSE elem::text
        END
    )
    FROM jsonb_array_elements(external_tracking_numbers) as elem
)
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(external_tracking_numbers) as elem
    WHERE jsonb_typeof(elem) = 'object'
  );

-- 3. 验证修复结果
SELECT 
    auto_number,
    external_tracking_numbers,
    jsonb_typeof(external_tracking_numbers) as data_type,
    jsonb_array_length(external_tracking_numbers) as array_length
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;

-- 4. 检查修复后的运单号内容
SELECT 
    auto_number,
    jsonb_array_elements(external_tracking_numbers) as tracking_element,
    jsonb_typeof(jsonb_array_elements(external_tracking_numbers)) as element_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;
