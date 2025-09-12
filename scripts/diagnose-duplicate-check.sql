-- 诊断验重功能 - 查询数据库中的匹配记录
-- 基于Excel记录：云南郝文学车队, 链路1, 李永峰, 云G04011D, 铜厂, 火车站, 2025-08-08, 1

-- 1. 查询项目是否存在
SELECT '=== 项目检查 ===' as check_type;
SELECT 
    id,
    name as project_name,
    '项目存在' as status
FROM public.projects 
WHERE name = '云南郝文学车队';

-- 2. 查询合作链路信息
SELECT '=== 合作链路检查 ===' as check_type;
SELECT 
    id as chain_id,
    chain_name,
    project_id,
    '合作链路存在' as status
FROM public.partner_chains 
WHERE chain_name = '链路1';

-- 3. 查询可能的重复记录（使用8个关键字段）
SELECT '=== 重复记录检查 ===' as check_type;
SELECT 
    lr.id,
    lr.auto_number,
    lr.project_name,
    pc.chain_name,
    lr.driver_name,
    lr.license_plate,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_date,
    lr.loading_date::date as loading_date_date_part,
    lr.loading_weight,
    '可能的重复记录' as status
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
WHERE 
    TRIM(lr.project_name) = '云南郝文学车队'
    AND TRIM(lr.driver_name) = '李永峰'
    AND TRIM(lr.license_plate) = '云G04011D'
    AND TRIM(lr.loading_location) = '铜厂'
    AND TRIM(lr.unloading_location) = '火车站'
    AND lr.loading_weight = 1;

-- 4. 检查日期匹配情况（重点检查时区问题）
SELECT '=== 日期匹配检查 ===' as check_type;
SELECT 
    lr.id,
    lr.auto_number,
    lr.loading_date,
    lr.loading_date::date as db_date_part,
    '2025-08-08'::date as excel_date_part,
    lr.loading_date::date = '2025-08-08'::date as date_match,
    EXTRACT(timezone_hour FROM lr.loading_date) as timezone_offset_hours,
    '日期比较结果' as status
FROM public.logistics_records lr
WHERE 
    TRIM(lr.project_name) = '云南郝文学车队'
    AND TRIM(lr.driver_name) = '李永峰'
    AND TRIM(lr.license_plate) = '云G04011D'
    AND TRIM(lr.loading_location) = '铜厂'
    AND TRIM(lr.unloading_location) = '火车站'
    AND lr.loading_weight = 1;

-- 5. 模拟验重函数的时区转换逻辑
SELECT '=== 时区转换测试 ===' as check_type;
WITH timezone_test AS (
    SELECT 
        '2025-08-08' as excel_date_str,
        ('2025-08-08 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC' as converted_utc,
        (('2025-08-08 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC')::date as converted_date_part
)
SELECT 
    excel_date_str,
    converted_utc,
    converted_date_part,
    '时区转换结果' as status
FROM timezone_test;

-- 6. 完整的验重逻辑模拟
SELECT '=== 完整验重逻辑模拟 ===' as check_type;
WITH test_data AS (
    SELECT 
        '云南郝文学车队' as project_name,
        '链路1' as chain_name,
        '李永峰' as driver_name,
        '云G04011D' as license_plate,
        '铜厂' as loading_location,
        '火车站' as unloading_location,
        '2025-08-08' as loading_date_str,
        1 as loading_weight
),
chain_lookup AS (
    SELECT 
        td.*,
        pc.id as chain_id
    FROM test_data td
    LEFT JOIN public.partner_chains pc ON td.chain_name = pc.chain_name
),
date_conversion AS (
    SELECT 
        cl.*,
        (cl.loading_date_str || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC' as loading_date_utc,
        ((cl.loading_date_str || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC')::date as loading_date_date_part
    FROM chain_lookup cl
)
SELECT 
    dc.*,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.logistics_records lr
            WHERE 
                TRIM(lr.project_name) = TRIM(dc.project_name)
                AND lr.chain_id = dc.chain_id
                AND TRIM(lr.driver_name) = TRIM(dc.driver_name)
                AND TRIM(lr.license_plate) = TRIM(dc.license_plate)
                AND TRIM(lr.loading_location) = TRIM(dc.loading_location)
                AND TRIM(lr.unloading_location) = TRIM(dc.unloading_location)
                AND lr.loading_date::date = dc.loading_date_date_part
                AND lr.loading_weight = dc.loading_weight
        ) THEN '发现重复记录'
        ELSE '未发现重复记录'
    END as duplicate_check_result
FROM date_conversion dc;

-- 7. 检查所有相关记录的详细信息
SELECT '=== 所有相关记录详情 ===' as check_type;
SELECT 
    lr.id,
    lr.auto_number,
    lr.project_name,
    pc.chain_name,
    lr.driver_name,
    lr.license_plate,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_date,
    lr.loading_weight,
    lr.created_at,
    '相关记录详情' as status
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
WHERE 
    lr.project_name ILIKE '%云南%' 
    OR lr.driver_name ILIKE '%李永峰%'
    OR lr.license_plate ILIKE '%云G04011D%'
    OR lr.loading_location ILIKE '%铜厂%'
    OR lr.unloading_location ILIKE '%火车站%'
ORDER BY lr.created_at DESC;
