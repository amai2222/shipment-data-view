-- 修改 external_tracking_numbers 字段为 TEXT[] 类型
-- 这样更简单、性能更好、查询更方便

-- 1. 首先备份现有数据
CREATE TABLE IF NOT EXISTS logistics_records_backup AS 
SELECT * FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb;

-- 2. 添加新的 TEXT[] 字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS external_tracking_numbers_new TEXT[] DEFAULT '{}';

-- 3. 迁移数据：将 JSONB 数组转换为 TEXT[] 数组
UPDATE public.logistics_records 
SET external_tracking_numbers_new = (
    SELECT array_agg(elem::text)
    FROM jsonb_array_elements_text(external_tracking_numbers) as elem
    WHERE elem::text != ''
)
WHERE external_tracking_numbers IS NOT NULL 
  AND external_tracking_numbers != '[]'::jsonb;

-- 4. 验证数据迁移结果
SELECT 
    auto_number,
    external_tracking_numbers as old_format,
    external_tracking_numbers_new as new_format,
    array_length(external_tracking_numbers_new, 1) as array_length
FROM logistics_records 
WHERE external_tracking_numbers_new IS NOT NULL 
  AND array_length(external_tracking_numbers_new, 1) > 0
ORDER BY created_at DESC
LIMIT 10;

-- 5. 删除旧的 JSONB 字段
-- ALTER TABLE public.logistics_records DROP COLUMN external_tracking_numbers;

-- 6. 重命名新字段
-- ALTER TABLE public.logistics_records RENAME COLUMN external_tracking_numbers_new TO external_tracking_numbers;

-- 7. 添加字段注释
-- COMMENT ON COLUMN public.logistics_records.external_tracking_numbers IS '其他平台运单号码数组，同一平台的多个运单号用|分隔';

-- 8. 创建索引
-- CREATE INDEX IF NOT EXISTS idx_logistics_records_external_tracking_new 
-- ON public.logistics_records USING GIN (external_tracking_numbers);

-- 9. 测试查询功能
-- 根据运单号查找记录
SELECT 
    auto_number,
    project_name,
    driver_name,
    external_tracking_numbers_new
FROM logistics_records
WHERE '2021615278' = ANY(external_tracking_numbers_new)
LIMIT 5;

-- 10. 解析运单号（支持|分隔）
SELECT 
    auto_number,
    other_platform_names,
    external_tracking_numbers_new,
    unnest(external_tracking_numbers_new) as tracking_string,
    string_to_array(unnest(external_tracking_numbers_new), '|') as individual_tracking_numbers
FROM logistics_records
WHERE external_tracking_numbers_new IS NOT NULL 
  AND array_length(external_tracking_numbers_new, 1) > 0
LIMIT 10;
