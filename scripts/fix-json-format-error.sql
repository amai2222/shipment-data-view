-- 修复JSON格式错误
-- 错误：ERROR: 22P02: invalid input syntax for type json
-- 问题：JSON数据格式不正确，包含无效的token

-- 1. 检查是否有损坏的JSON数据
SELECT 
    auto_number,
    external_tracking_numbers,
    other_platform_names,
    pg_typeof(external_tracking_numbers) as external_tracking_type,
    pg_typeof(other_platform_names) as other_platform_type
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
   OR other_platform_names IS NOT NULL
LIMIT 5;

-- 2. 查找包含无效JSON的记录
SELECT 
    auto_number,
    external_tracking_numbers,
    other_platform_names
FROM logistics_records 
WHERE external_tracking_numbers::text LIKE '%79af9bal%'
   OR other_platform_names::text LIKE '%79af9bal%'
   OR external_tracking_numbers::text LIKE '%invalid%'
   OR other_platform_names::text LIKE '%invalid%';

-- 3. 检查JSON字段的数据完整性
DO $$
DECLARE
    rec RECORD;
    json_valid boolean;
BEGIN
    FOR rec IN 
        SELECT auto_number, external_tracking_numbers, other_platform_names
        FROM logistics_records 
        WHERE external_tracking_numbers IS NOT NULL 
           OR other_platform_names IS NOT NULL
        LIMIT 10
    LOOP
        BEGIN
            -- 测试external_tracking_numbers是否为有效JSON
            IF rec.external_tracking_numbers IS NOT NULL THEN
                PERFORM rec.external_tracking_numbers::jsonb;
                RAISE NOTICE '✅ % - external_tracking_numbers 有效', rec.auto_number;
            END IF;
            
            -- 测试other_platform_names是否为有效JSON
            IF rec.other_platform_names IS NOT NULL THEN
                PERFORM rec.other_platform_names::jsonb;
                RAISE NOTICE '✅ % - other_platform_names 有效', rec.auto_number;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ % - JSON格式错误: %', rec.auto_number, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. 清理无效的JSON数据
UPDATE logistics_records 
SET external_tracking_numbers = NULL
WHERE external_tracking_numbers IS NOT NULL 
  AND NOT (external_tracking_numbers::text ~ '^\[.*\]$' OR external_tracking_numbers::text ~ '^\{.*\}$');

UPDATE logistics_records 
SET other_platform_names = NULL
WHERE other_platform_names IS NOT NULL 
  AND NOT (other_platform_names::text ~ '^\[.*\]$' OR other_platform_names::text ~ '^\{.*\}$');

-- 5. 验证清理结果
SELECT 
    COUNT(*) as total_records,
    COUNT(external_tracking_numbers) as valid_external_tracking,
    COUNT(other_platform_names) as valid_other_platform_names
FROM logistics_records;

-- 6. 测试JSON函数
DO $$
DECLARE
    test_json jsonb;
    test_array text[];
BEGIN
    -- 测试有效的JSON
    test_json := '[
        {
            "platform": "货拉拉",
            "tracking_number": "HL20250120001",
            "status": "pending",
            "created_at": "2025-01-20T08:00:00Z"
        }
    ]'::jsonb;
    
    RAISE NOTICE '✅ 有效JSON测试通过: %', test_json;
    
    -- 测试有效的数组
    test_array := ARRAY['货拉拉', '满帮', '运满满'];
    
    RAISE NOTICE '✅ 有效数组测试通过: %', test_array;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ JSON测试失败: %', SQLERRM;
END $$;
