-- 测试磅单管理修复效果
-- 1. 检查车次逻辑修复
-- 2. 验证编辑模式下车次正确显示

-- 查询现有磅单记录，检查车次分布
SELECT 
    project_name,
    loading_date,
    license_plate,
    trip_number,
    valid_quantity,
    billing_type_id,
    created_at
FROM scale_records 
WHERE project_name = '中粮扎兰屯' 
  AND loading_date = '2025-09-04'
  AND license_plate = '吉DA9931'
ORDER BY trip_number;

-- 查询计费方式数据
SELECT 
    billing_type_id,
    type_name,
    type_code
FROM billing_types 
ORDER BY billing_type_id;

-- 检查磅单记录总数
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN image_urls IS NOT NULL AND array_length(image_urls, 1) > 0 THEN 1 END) as records_with_images,
    COUNT(CASE WHEN logistics_number IS NOT NULL THEN 1 END) as records_with_waybill
FROM scale_records;
