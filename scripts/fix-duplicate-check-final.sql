-- 最终修复验重功能问题
-- 问题：合作链路ID查找逻辑不完整，需要同时匹配项目ID

-- 1. 修复验重函数
CREATE OR REPLACE FUNCTION public.preview_import_with_duplicates_check(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    new_records_json jsonb := '[]'::jsonb;
    duplicate_records_json jsonb := '[]'::jsonb;
    error_records_json jsonb := '[]'::jsonb;
    project_exists boolean;
    is_duplicate boolean;
    chain_name_val text;
    loading_date_formatted text;
    chain_id_val uuid;
    project_id_val uuid;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        -- 1. 检查必填字段（8个关键字段）
        IF (record_data->>'project_name') IS NULL OR TRIM(record_data->>'project_name') = '' OR
           (record_data->>'driver_name') IS NULL OR TRIM(record_data->>'driver_name') = '' OR
           (record_data->>'license_plate') IS NULL OR TRIM(record_data->>'license_plate') = '' OR
           (record_data->>'loading_location') IS NULL OR TRIM(record_data->>'loading_location') = '' OR
           (record_data->>'unloading_location') IS NULL OR TRIM(record_data->>'unloading_location') = '' OR
           (record_data->>'loading_date') IS NULL OR TRIM(record_data->>'loading_date') = '' OR
           (record_data->>'loading_weight') IS NULL OR TRIM(record_data->>'loading_weight') = '' THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '缺少必填字段（8个关键字段）');
            CONTINUE;
        END IF;

        -- 2. 检查项目是否存在并获取项目ID
        SELECT EXISTS (SELECT 1 FROM public.projects WHERE name = TRIM(record_data->>'project_name')) INTO project_exists;
        IF NOT project_exists THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '项目不存在');
            CONTINUE;
        END IF;

        -- 获取项目ID
        SELECT id INTO project_id_val FROM public.projects WHERE name = TRIM(record_data->>'project_name');

        -- 3. 获取合作链路ID（修复：需要同时匹配项目ID）
        chain_name_val := TRIM(record_data->>'chain_name');
        IF chain_name_val IS NOT NULL AND chain_name_val != '' THEN
            SELECT id INTO chain_id_val 
            FROM public.partner_chains 
            WHERE chain_name = chain_name_val AND project_id = project_id_val;
        ELSE
            chain_id_val := NULL;
        END IF;

        -- 4. 日期处理
        loading_date_formatted := TRIM(record_data->>'loading_date');

        -- 5. 检查重复数据（使用8个关键字段）
        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            WHERE
                TRIM(lr.project_name) = TRIM(record_data->>'project_name')                    -- 1. 项目名称
                AND lr.chain_id = chain_id_val                                               -- 2. 合作链路ID
                AND TRIM(lr.driver_name) = TRIM(record_data->>'driver_name')                 -- 3. 司机姓名
                AND TRIM(lr.license_plate) = TRIM(record_data->>'license_plate')             -- 4. 车牌号
                AND TRIM(lr.loading_location) = TRIM(record_data->>'loading_location')       -- 5. 装货地点
                AND TRIM(lr.unloading_location) = TRIM(record_data->>'unloading_location')   -- 6. 卸货地点
                AND lr.loading_date::date = loading_date_formatted::date                     -- 7. 装货日期（直接比较日期部分）
                AND lr.loading_weight = (record_data->>'loading_weight')::numeric            -- 8. 装货数量
        ) INTO is_duplicate;

        -- 6. 分类记录
        IF is_duplicate THEN
            duplicate_records_json := duplicate_records_json || jsonb_build_object('record', record_data);
        ELSE
            new_records_json := new_records_json || jsonb_build_object('record', record_data);
        END IF;

    END LOOP;

    -- 7. 返回分类结果
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'duplicate_records', duplicate_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- 2. 测试修复后的验重函数
SELECT '=== 测试修复后的验重函数 ===' as test_title;
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

-- 3. 验证合作链路ID查找逻辑
SELECT '=== 验证合作链路ID查找逻辑 ===' as test_title;
WITH test_data AS (
    SELECT 
        '云南郝文学车队' as project_name,
        '链路1' as chain_name
)
SELECT 
    td.project_name,
    td.chain_name,
    p.id as project_id,
    pc.id as chain_id,
    pc.chain_name as found_chain_name,
    CASE 
        WHEN pc.id IS NOT NULL THEN '找到合作链路ID'
        ELSE '未找到合作链路ID'
    END as lookup_result
FROM test_data td
LEFT JOIN public.projects p ON p.name = td.project_name
LEFT JOIN public.partner_chains pc ON pc.chain_name = td.chain_name AND pc.project_id = p.id;

-- 4. 检查数据库中的实际记录
SELECT '=== 数据库中的实际记录 ===' as test_title;
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
    lr.loading_weight,
    '数据库中的实际记录' as status
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
