-- 多装多卸功能测试脚本 V2 (简化版)
-- 此脚本使用指定用户ID，避免外键约束问题

-- 1. 测试地点数组比较函数
SELECT 
    '测试1: 地点数组比较函数' as test_case,
    public.compare_location_arrays_v2('北京|上海', '上海|北京') as result,
    '应该返回true' as expected;

-- 2. 测试地点字符串解析函数
SELECT 
    '测试2: 地点字符串解析' as test_case,
    public.parse_location_string_v2('北京|上海|广州') as result,
    '应该返回["北京","上海","广州"]' as expected;

-- 3. 测试地点获取或创建函数
SELECT 
    '测试3: 地点获取或创建' as test_case,
    public.get_or_create_locations_from_string_v2('测试地点1|测试地点2') as result,
    '应该返回地点ID数组' as expected;

-- 4. 测试验重函数（使用现有数据）
SELECT 
    '测试4: 验重函数测试' as test_case,
    public.preview_import_with_duplicates_check_v2('[
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

-- 5. 测试单个记录验重
SELECT 
    '测试5: 单个记录验重' as test_case,
    public.check_logistics_record_duplicate_v2(
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

-- 6. 测试添加运单记录（使用指定用户）
DO $$
DECLARE
    test_user_id uuid := '7136e5fd-08ae-47ea-a22b-34c1a1745206'::uuid;
    test_project_id uuid;
    test_chain_id uuid;
    test_driver_id uuid;
BEGIN
    -- 创建测试项目
    INSERT INTO public.projects (id, name, start_date, end_date, manager, loading_address, unloading_address, user_id) 
    VALUES ('550e8400-e29b-41d4-a716-446655440001'::uuid, '多地点测试项目V2', '2025-01-01', '2025-12-31', '测试经理', '测试装货地址', '测试卸货地址', test_user_id)
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO test_project_id;
    
    -- 创建合作链路
    INSERT INTO public.partner_chains (id, chain_name, project_id, billing_type_id, is_default, user_id) 
    VALUES ('550e8400-e29b-41d4-a716-446655440002'::uuid, '默认链路V2', test_project_id, 1, true, test_user_id)
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO test_chain_id;
    
    -- 创建司机
    INSERT INTO public.drivers (id, name, license_plate, phone, user_id) 
    VALUES ('550e8400-e29b-41d4-a716-446655440003'::uuid, '多地点测试司机V2', '测试A12345V2', '13800138000', test_user_id)
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO test_driver_id;
    
    -- 测试添加运单记录
    PERFORM public.add_logistics_record_with_costs_v2(
        test_project_id,
        test_chain_id,
        test_driver_id,
        '多地点测试项目V2',
        '默认链路V2',
        '多地点测试司机V2',
        '测试A12345V2',
        '13800138000',
        '北京|上海',
        '广州|深圳',
        '2025-01-20',
        25.5,
        '实际运输',
        1500.00,
        1500.00,
        test_user_id
    );
    
    RAISE NOTICE '测试数据创建成功，项目ID: %, 链路ID: %, 司机ID: %', test_project_id, test_chain_id, test_driver_id;
END $$;

-- 7. 测试批量导入
SELECT 
    '测试7: 批量导入测试' as test_case,
    public.import_logistics_data_v2('[
      {
        "project_name": "多地点测试项目V2",
        "chain_name": "默认链路V2",
        "driver_name": "多地点测试司机V2",
        "license_plate": "测试A12345V2",
        "loading_location": "上海|北京",
        "unloading_location": "深圳|广州",
        "loading_date": "2025-01-21",
        "loading_weight": "30.0"
      }
    ]'::jsonb) as result,
    '应该成功导入多地点数据' as expected;

-- 8. 验证数据是否正确创建
SELECT 
    '测试8: 数据验证' as test_case,
    COUNT(*) as record_count,
    '应该看到创建的测试记录' as expected
FROM public.logistics_records 
WHERE project_name = '多地点测试项目V2';

-- 9. 验证多地点数据格式
SELECT 
    '测试9: 多地点格式验证' as test_case,
    loading_location,
    unloading_location,
    '应该看到|分隔的多地点数据' as expected
FROM public.logistics_records 
WHERE project_name = '多地点测试项目V2'
LIMIT 3;

-- 10. 清理测试数据（可选）
-- 如果需要清理测试数据，取消注释以下语句
/*
DELETE FROM public.logistics_records WHERE project_name = '多地点测试项目V2';
DELETE FROM public.drivers WHERE name = '多地点测试司机V2';
DELETE FROM public.partner_chains WHERE chain_name = '默认链路V2';
DELETE FROM public.projects WHERE name = '多地点测试项目V2';
*/
