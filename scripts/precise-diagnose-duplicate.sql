-- 精确诊断验重功能问题
-- 基于验重函数测试结果，找出为什么没有识别到重复记录

-- 1. 检查数据库中是否存在完全匹配的记录
SELECT '=== 数据库中的匹配记录 ===' as check_type;
SELECT 
    lr.id,
    lr.auto_number,
    lr.project_name,
    pc.chain_name,
    pc.id as chain_id,
    lr.driver_name,
    lr.license_plate,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_date,
    lr.loading_date::date as loading_date_date_part,
    lr.loading_weight,
    '数据库中的匹配记录' as status
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
WHERE 
    lr.project_name = '云南郝文学车队'
    AND pc.chain_name = '链路1'
    AND lr.driver_name = '李永峰'
    AND lr.license_plate = '云G04011D'
    AND lr.loading_location = '铜厂'
    AND lr.unloading_location = '火车站'
    AND lr.loading_date::date = '2025-08-08'::date
    AND lr.loading_weight = 1;

-- 2. 检查合作链路ID是否正确
SELECT '=== 合作链路ID检查 ===' as check_type;
SELECT 
    pc.id as chain_id,
    pc.chain_name,
    pc.project_id,
    p.name as project_name,
    '合作链路信息' as status
FROM public.partner_chains pc
INNER JOIN public.projects p ON pc.project_id = p.id
WHERE pc.chain_name = '链路1' AND p.name = '云南郝文学车队';

-- 3. 模拟验重函数中的合作链路ID查找逻辑
SELECT '=== 验重函数中的合作链路ID查找 ===' as check_type;
WITH test_data AS (
    SELECT 
        '云南郝文学车队' as project_name,
        '链路1' as chain_name
)
SELECT 
    td.project_name,
    td.chain_name,
    pc.id as found_chain_id,
    CASE 
        WHEN pc.id IS NOT NULL THEN '找到合作链路ID'
        ELSE '未找到合作链路ID'
    END as lookup_result
FROM test_data td
LEFT JOIN public.partner_chains pc ON td.chain_name = pc.chain_name
LEFT JOIN public.projects p ON pc.project_id = p.id AND p.name = td.project_name;

-- 4. 检查验重函数中的具体比较逻辑
SELECT '=== 验重函数比较逻辑测试 ===' as check_type;
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
    LEFT JOIN public.projects p ON pc.project_id = p.id AND p.name = td.project_name
)
SELECT 
    cl.project_name,
    cl.chain_name,
    cl.chain_id,
    cl.driver_name,
    cl.license_plate,
    cl.loading_location,
    cl.unloading_location,
    cl.loading_date_str,
    cl.loading_weight,
    -- 逐个检查每个条件
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE TRIM(lr.project_name) = TRIM(cl.project_name)) as project_name_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE lr.chain_id = cl.chain_id) as chain_id_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE TRIM(lr.driver_name) = TRIM(cl.driver_name)) as driver_name_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE TRIM(lr.license_plate) = TRIM(cl.license_plate)) as license_plate_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE TRIM(lr.loading_location) = TRIM(cl.loading_location)) as loading_location_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE TRIM(lr.unloading_location) = TRIM(cl.unloading_location)) as unloading_location_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE lr.loading_date::date = cl.loading_date_str::date) as loading_date_matches,
    (SELECT COUNT(*) FROM public.logistics_records lr WHERE lr.loading_weight = cl.loading_weight) as loading_weight_matches,
    '条件匹配统计' as status
FROM chain_lookup cl;

-- 5. 检查完整的重复记录查询
SELECT '=== 完整重复记录查询 ===' as check_type;
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
    LEFT JOIN public.projects p ON pc.project_id = p.id AND p.name = td.project_name
)
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
    '完整重复记录查询结果' as status
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
CROSS JOIN chain_lookup cl
WHERE 
    TRIM(lr.project_name) = TRIM(cl.project_name)
    AND lr.chain_id = cl.chain_id
    AND TRIM(lr.driver_name) = TRIM(cl.driver_name)
    AND TRIM(lr.license_plate) = TRIM(cl.license_plate)
    AND TRIM(lr.loading_location) = TRIM(cl.loading_location)
    AND TRIM(lr.unloading_location) = TRIM(cl.unloading_location)
    AND lr.loading_date::date = cl.loading_date_str::date
    AND lr.loading_weight = cl.loading_weight;

-- 6. 检查是否有NULL值问题
SELECT '=== NULL值检查 ===' as check_type;
SELECT 
    COUNT(*) as total_records,
    COUNT(project_name) as project_name_count,
    COUNT(chain_id) as chain_id_count,
    COUNT(driver_name) as driver_name_count,
    COUNT(license_plate) as license_plate_count,
    COUNT(loading_location) as loading_location_count,
    COUNT(unloading_location) as unloading_location_count,
    COUNT(loading_date) as loading_date_count,
    COUNT(loading_weight) as loading_weight_count,
    'NULL值统计' as status
FROM public.logistics_records lr
WHERE 
    lr.project_name = '云南郝文学车队'
    AND lr.driver_name = '李永峰'
    AND lr.license_plate = '云G04011D'
    AND lr.loading_location = '铜厂'
    AND lr.unloading_location = '火车站'
    AND lr.loading_date::date = '2025-08-08'::date
    AND lr.loading_weight = 1;
