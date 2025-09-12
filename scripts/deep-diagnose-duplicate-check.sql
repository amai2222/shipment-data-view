-- 深度诊断验重功能问题
-- 基于Excel记录：云南郝文学车队, 链路1, 李永峰, 云G04011D, 铜厂, 火车站, 2025-08-08, 1

-- 1. 检查具体的重复记录
SELECT '=== 具体重复记录检查 ===' as check_type;
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
    '具体重复记录' as status
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
WHERE 
    TRIM(lr.project_name) = '云南郝文学车队'
    AND TRIM(lr.driver_name) = '李永峰'
    AND TRIM(lr.license_plate) = '云G04011D'
    AND TRIM(lr.loading_location) = '铜厂'
    AND TRIM(lr.unloading_location) = '火车站'
    AND lr.loading_weight = 1
    AND lr.loading_date::date = '2025-08-08'::date;

-- 2. 检查合作链路ID匹配
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

-- 3. 模拟验重函数的完整逻辑
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
    LEFT JOIN public.projects p ON pc.project_id = p.id AND p.name = td.project_name
),
duplicate_check AS (
    SELECT 
        cl.*,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM public.logistics_records lr
                WHERE 
                    TRIM(lr.project_name) = TRIM(cl.project_name)
                    AND lr.chain_id = cl.chain_id
                    AND TRIM(lr.driver_name) = TRIM(cl.driver_name)
                    AND TRIM(lr.license_plate) = TRIM(cl.license_plate)
                    AND TRIM(lr.loading_location) = TRIM(cl.loading_location)
                    AND TRIM(lr.unloading_location) = TRIM(cl.unloading_location)
                    AND lr.loading_date::date = cl.loading_date_str::date
                    AND lr.loading_weight = cl.loading_weight
            ) THEN '发现重复记录'
            ELSE '未发现重复记录'
        END as duplicate_result,
        (SELECT COUNT(*) FROM public.logistics_records lr
         WHERE 
             TRIM(lr.project_name) = TRIM(cl.project_name)
             AND lr.chain_id = cl.chain_id
             AND TRIM(lr.driver_name) = TRIM(cl.driver_name)
             AND TRIM(lr.license_plate) = TRIM(cl.license_plate)
             AND TRIM(lr.loading_location) = TRIM(cl.loading_location)
             AND TRIM(lr.unloading_location) = TRIM(cl.unloading_location)
             AND lr.loading_date::date = cl.loading_date_str::date
             AND lr.loading_weight = cl.loading_weight
        ) as matching_count
    FROM chain_lookup cl
)
SELECT 
    project_name,
    chain_name,
    chain_id,
    driver_name,
    license_plate,
    loading_location,
    unloading_location,
    loading_date_str,
    loading_weight,
    duplicate_result,
    matching_count,
    '完整验重结果' as status
FROM duplicate_check;

-- 4. 逐步检查每个条件
SELECT '=== 逐步条件检查 ===' as check_type;
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
    '条件1: 项目名称匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE TRIM(lr.project_name) = '云南郝文学车队'

UNION ALL

SELECT 
    '条件2: 合作链路ID匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
INNER JOIN public.partner_chains pc ON lr.chain_id = pc.id
WHERE pc.chain_name = '链路1'

UNION ALL

SELECT 
    '条件3: 司机姓名匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE TRIM(lr.driver_name) = '李永峰'

UNION ALL

SELECT 
    '条件4: 车牌号匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE TRIM(lr.license_plate) = '云G04011D'

UNION ALL

SELECT 
    '条件5: 装货地点匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE TRIM(lr.loading_location) = '铜厂'

UNION ALL

SELECT 
    '条件6: 卸货地点匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE TRIM(lr.unloading_location) = '火车站'

UNION ALL

SELECT 
    '条件7: 装货日期匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE lr.loading_date::date = '2025-08-08'::date

UNION ALL

SELECT 
    '条件8: 装货数量匹配' as condition_name,
    COUNT(*) as matching_records
FROM public.logistics_records lr
WHERE lr.loading_weight = 1;

-- 5. 检查所有条件组合
SELECT '=== 所有条件组合检查 ===' as check_type;
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
    '所有条件组合匹配' as status
FROM public.logistics_records lr
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
WHERE 
    TRIM(lr.project_name) = '云南郝文学车队'
    AND pc.chain_name = '链路1'
    AND TRIM(lr.driver_name) = '李永峰'
    AND TRIM(lr.license_plate) = '云G04011D'
    AND TRIM(lr.loading_location) = '铜厂'
    AND TRIM(lr.unloading_location) = '火车站'
    AND lr.loading_date::date = '2025-08-08'::date
    AND lr.loading_weight = 1;

-- 6. 测试验重函数调用
SELECT '=== 测试验重函数调用 ===' as check_type;
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "云南郝文学车队",
            "chain_name": "链路1",
            "driver_name": "李永峰",
            "license_plate": "云G04011D",
            "loading_location": "铜厂",
            "unloading_location": "火车站",
            "loading_date": "2025-08-08",
            "loading_weight": "1"
        }
    ]'::jsonb
) as duplicate_check_result;
