-- 多地点自动创建功能测试脚本

-- 1. 测试地点字符串解析
SELECT 
    '测试1: 地点字符串解析' as test_case,
    public.parse_location_string('北京|上海|广州') as result,
    '应该返回["北京","上海","广州"]' as expected;

-- 2. 测试地点获取或创建
SELECT 
    '测试2: 地点获取或创建' as test_case,
    public.get_or_create_locations_from_string('测试地点1|测试地点2') as result,
    '应该返回地点ID数组' as expected;

-- 3. 测试批量地点获取或创建
SELECT 
    '测试3: 批量地点获取或创建' as test_case,
    public.get_or_create_locations_batch(ARRAY['北京|上海', '广州|深圳']) as result,
    '应该返回地点ID数组的数组' as expected;

-- 4. 测试批量导入（使用现有数据）
SELECT 
    '测试4: 批量导入测试' as test_case,
    public.batch_import_logistics_records('[
      {
        "project_name": "测试项目",
        "chain_name": "测试链路",
        "driver_name": "测试司机",
        "license_plate": "测试A12345",
        "loading_location": "新地点1|新地点2",
        "unloading_location": "新地点3|新地点4",
        "loading_date": "2025-01-20",
        "loading_weight": "25.5"
      }
    ]'::jsonb) as result,
    '应该成功导入并自动创建新地点' as expected;

-- 5. 验证新地点是否被创建
SELECT 
    '测试5: 验证新地点创建' as test_case,
    COUNT(*) as new_location_count,
    '应该看到新创建的地点' as expected
FROM public.locations 
WHERE name IN ('新地点1', '新地点2', '新地点3', '新地点4');

-- 6. 验证运单记录是否正确创建
SELECT 
    '测试6: 验证运单记录创建' as test_case,
    COUNT(*) as record_count,
    '应该看到新创建的运单记录' as expected
FROM public.logistics_records 
WHERE loading_location LIKE '%新地点%' OR unloading_location LIKE '%新地点%';
