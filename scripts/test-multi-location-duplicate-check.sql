-- 多装多卸验重逻辑测试脚本

-- 1. 测试地点数组比较函数
SELECT 
    '测试1: 地点数组比较 - 相同顺序' as test_case,
    public.compare_location_arrays('北京|上海', '北京|上海') as result,
    '应该返回true' as expected;

SELECT 
    '测试2: 地点数组比较 - 不同顺序' as test_case,
    public.compare_location_arrays('北京|上海', '上海|北京') as result,
    '应该返回true' as expected;

SELECT 
    '测试3: 地点数组比较 - 不同内容' as test_case,
    public.compare_location_arrays('北京|上海', '北京|广州') as result,
    '应该返回false' as expected;

SELECT 
    '测试4: 地点数组比较 - 空值处理' as test_case,
    public.compare_location_arrays('', '') as result,
    '应该返回true' as expected;

-- 2. 测试验重函数
SELECT 
    '测试5: 验重函数 - 多地点数据' as test_case,
    public.preview_import_with_duplicates_check('[
      {
        "project_name": "测试项目",
        "chain_name": "测试链路",
        "driver_name": "测试司机",
        "license_plate": "测试A12345",
        "loading_location": "北京|上海",
        "unloading_location": "广州|深圳",
        "loading_date": "2025-01-20",
        "loading_weight": "25.5"
      }
    ]'::jsonb) as result,
    '应该正常处理多地点数据' as expected;

-- 3. 测试单个记录验重
SELECT 
    '测试6: 单个记录验重' as test_case,
    public.check_logistics_record_duplicate(
        '测试项目',
        '测试链路',
        '测试司机',
        '测试A12345',
        '北京|上海',
        '广州|深圳',
        '2025-01-20',
        25.5
    ) as result,
    '应该返回重复检查结果' as expected;
