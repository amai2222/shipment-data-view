-- 清理和修正现有的 external_tracking_numbers 数据格式
-- 将复杂的JSONB对象结构转换为简单的运单号字符串数组

-- 1. 查看当前数据格式
SELECT 
    auto_number,
    other_platform_names,
    external_tracking_numbers,
    jsonb_typeof(external_tracking_numbers) as data_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 2. 分析现有数据的结构
SELECT 
    auto_number,
    jsonb_array_elements(external_tracking_numbers) as tracking_element
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;

-- 3. 提取运单号并重新格式化
-- 将复杂的JSONB对象转换为简单的运单号字符串数组
-- 同一平台的多个运单号用|分隔存储为一个字符串元素
UPDATE logistics_records 
SET external_tracking_numbers = (
    SELECT jsonb_agg(
        CASE 
            -- 如果元素是对象，提取tracking_number字段并用|连接
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

-- 4. 验证修正后的数据格式
SELECT 
    auto_number,
    other_platform_names,
    external_tracking_numbers,
    jsonb_typeof(external_tracking_numbers) as data_type,
    jsonb_array_length(external_tracking_numbers) as array_length
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;

-- 5. 检查修正后的运单号内容
SELECT 
    auto_number,
    jsonb_array_elements(external_tracking_numbers) as tracking_number,
    jsonb_typeof(jsonb_array_elements(external_tracking_numbers)) as element_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 10;

-- 6. 统计修正前后的数据格式分布
-- 使用子查询来避免在WHERE子句中使用集合函数
SELECT 
    '修正前' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'object'
        ) THEN 'JSONB对象'
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'string'
        ) THEN '字符串'
        ELSE '其他类型'
    END as format_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
GROUP BY 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'object'
        ) THEN 'JSONB对象'
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'string'
        ) THEN '字符串'
        ELSE '其他类型'
    END

UNION ALL

-- 注意：这个查询需要在UPDATE之后运行才能看到修正后的结果
SELECT 
    '修正后' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'object'
        ) THEN 'JSONB对象'
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'string'
        ) THEN '字符串'
        ELSE '其他类型'
    END as format_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb
GROUP BY 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'object'
        ) THEN 'JSONB对象'
        WHEN EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(external_tracking_numbers) as elem
            WHERE jsonb_typeof(elem) = 'string'
        ) THEN '字符串'
        ELSE '其他类型'
    END;
