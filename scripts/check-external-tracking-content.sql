-- 检查external_tracking_numbers字段的具体内容
-- 基于查询结果：所有记录都有external_tracking_numbers，但可能内容不正确

-- 1. 查看external_tracking_numbers的具体内容
SELECT 
    auto_number,
    external_tracking_numbers,
    LENGTH(external_tracking_numbers::text) as json_length,
    external_tracking_numbers::text as json_text
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 2. 检查external_tracking_numbers是否为空数组或空对象
SELECT 
    '空数组' as content_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers = '[]'::jsonb

UNION ALL

SELECT 
    '空对象' as content_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers = '{}'::jsonb

UNION ALL

SELECT 
    'null值' as content_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers = 'null'::jsonb

UNION ALL

SELECT 
    '有内容' as content_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb 
  AND external_tracking_numbers != '{}'::jsonb 
  AND external_tracking_numbers != 'null'::jsonb;

-- 3. 检查external_tracking_numbers的数据类型
SELECT 
    pg_typeof(external_tracking_numbers) as data_type,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL
GROUP BY pg_typeof(external_tracking_numbers);

-- 4. 查看external_tracking_numbers的JSON结构
DO $$
DECLARE
    rec RECORD;
    json_keys text[];
    key text;
BEGIN
    FOR rec IN 
        SELECT auto_number, external_tracking_numbers
        FROM logistics_records 
        WHERE external_tracking_numbers IS NOT NULL
        LIMIT 3
    LOOP
        BEGIN
            -- 检查是否为数组
            IF jsonb_typeof(rec.external_tracking_numbers) = 'array' THEN
                RAISE NOTICE '✅ % - external_tracking_numbers是数组，长度: %', 
                    rec.auto_number, jsonb_array_length(rec.external_tracking_numbers);
                
                -- 显示数组内容
                RAISE NOTICE '   内容: %', rec.external_tracking_numbers;
            ELSE
                RAISE NOTICE '❌ % - external_tracking_numbers不是数组，类型: %', 
                    rec.auto_number, jsonb_typeof(rec.external_tracking_numbers);
                RAISE NOTICE '   内容: %', rec.external_tracking_numbers;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ % - external_tracking_numbers解析错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
END $$;

-- 5. 检查是否有有效的平台运单号数据
SELECT 
    '有效平台运单号' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND jsonb_typeof(external_tracking_numbers) = 'array'
  AND jsonb_array_length(external_tracking_numbers) > 0

UNION ALL

SELECT 
    '无效或空数据' as status,
    COUNT(*) as count
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND (jsonb_typeof(external_tracking_numbers) != 'array' 
       OR jsonb_array_length(external_tracking_numbers) = 0);

-- 6. 检查最近导入的记录是否包含平台字段
-- 查看最近7天的记录，看是否有通过Excel导入的包含平台字段的记录
SELECT 
    auto_number,
    project_name,
    external_tracking_numbers,
    other_platform_names,
    created_at
FROM logistics_records 
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (external_tracking_numbers IS NOT NULL 
       AND external_tracking_numbers != '[]'::jsonb 
       AND external_tracking_numbers != '{}'::jsonb
       AND external_tracking_numbers != 'null'::jsonb
       OR other_platform_names IS NOT NULL)
ORDER BY created_at DESC
LIMIT 10;
