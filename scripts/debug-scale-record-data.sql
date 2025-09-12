-- 调试磅单记录数据
-- 检查scale_records表中的数据完整性

-- 1. 查看表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'scale_records' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 查看最近几条记录的数据
SELECT 
    id,
    project_id,
    project_name,
    loading_date,
    trip_number,
    valid_quantity,
    billing_type_id,
    license_plate,
    driver_name,
    image_urls,
    created_at
FROM public.scale_records 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. 检查空值情况
SELECT 
    COUNT(*) as total_records,
    COUNT(license_plate) as license_plate_count,
    COUNT(trip_number) as trip_number_count,
    COUNT(valid_quantity) as valid_quantity_count,
    COUNT(billing_type_id) as billing_type_id_count
FROM public.scale_records;

-- 4. 检查特定字段的空值
SELECT 
    'license_plate' as field_name,
    COUNT(*) as total,
    COUNT(license_plate) as non_null,
    COUNT(*) - COUNT(license_plate) as null_count
FROM public.scale_records
UNION ALL
SELECT 
    'trip_number' as field_name,
    COUNT(*) as total,
    COUNT(trip_number) as non_null,
    COUNT(*) - COUNT(trip_number) as null_count
FROM public.scale_records
UNION ALL
SELECT 
    'valid_quantity' as field_name,
    COUNT(*) as total,
    COUNT(valid_quantity) as non_null,
    COUNT(*) - COUNT(valid_quantity) as null_count
FROM public.scale_records
UNION ALL
SELECT 
    'billing_type_id' as field_name,
    COUNT(*) as total,
    COUNT(billing_type_id) as non_null,
    COUNT(*) - COUNT(billing_type_id) as null_count
FROM public.scale_records;
