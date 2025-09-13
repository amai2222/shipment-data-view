-- 测试重复检测功能
-- 验证验重逻辑是否能正确识别重复记录

-- 1. 清理可能存在的测试数据
DELETE FROM public.logistics_records WHERE project_name = '重复检测测试项目';
DELETE FROM public.drivers WHERE name = '重复检测测试司机';
DELETE FROM public.partner_chains WHERE chain_name = '重复检测测试链路';
DELETE FROM public.projects WHERE name = '重复检测测试项目';

-- 2. 创建测试数据
DO $$
DECLARE
    test_user_id uuid := '7136e5fd-08ae-47ea-a22b-34c1a1745206'::uuid;
    test_project_id uuid;
    test_chain_id uuid;
    test_driver_id uuid;
    new_record_id uuid;
BEGIN
    -- 创建测试项目
    INSERT INTO public.projects (id, name, start_date, end_date, manager, loading_address, unloading_address, user_id) 
    VALUES ('550e8400-e29b-41d4-a716-446655440100'::uuid, '重复检测测试项目', '2025-01-01', '2025-12-31', '测试经理', '测试装货地址', '测试卸货地址', test_user_id)
    RETURNING id INTO test_project_id;
    
    -- 创建合作链路
    INSERT INTO public.partner_chains (id, chain_name, project_id, billing_type_id, is_default, user_id) 
    VALUES ('550e8400-e29b-41d4-a716-446655440101'::uuid, '重复检测测试链路', test_project_id, 1, true, test_user_id)
    RETURNING id INTO test_chain_id;
    
    -- 创建司机
    INSERT INTO public.drivers (id, name, license_plate, phone, user_id) 
    VALUES ('550e8400-e29b-41d4-a716-446655440102'::uuid, '重复检测测试司机', '重复检测A12345', '13800138000', test_user_id)
    RETURNING id INTO test_driver_id;
    
    -- 插入第一条记录
    INSERT INTO public.logistics_records (
        auto_number, project_id, chain_id, driver_id, project_name, driver_name,
        license_plate, driver_phone, loading_location, unloading_location, loading_date, 
        loading_weight, transport_type, user_id, created_by_user_id, created_at
    ) VALUES (
        public.generate_auto_number('2025-01-20'), test_project_id, test_chain_id, test_driver_id, '重复检测测试项目', '重复检测测试司机',
        '重复检测A12345', '13800138000', '北京|上海', '广州|深圳', '2025-01-20',
        25.5, '实际运输', test_user_id, test_user_id, NOW()
    ) RETURNING id INTO new_record_id;
    
    RAISE NOTICE '测试数据创建成功，记录ID: %', new_record_id;
END $$;

-- 3. 测试重复检测 - 应该返回 true（找到重复）
SELECT 
    '测试1: 重复检测 - 相同记录' as test_case,
    public.check_logistics_record_duplicate_v2(
        '重复检测测试项目',
        '重复检测测试链路',
        '重复检测测试司机',
        '重复检测A12345',
        '北京|上海',
        '广州|深圳',
        '2025-01-20',
        25.5
    ) as result,
    '应该返回true（找到重复）' as expected;

-- 4. 测试重复检测 - 应该返回 false（不同记录）
SELECT 
    '测试2: 重复检测 - 不同地点' as test_case,
    public.check_logistics_record_duplicate_v2(
        '重复检测测试项目',
        '重复检测测试链路',
        '重复检测测试司机',
        '重复检测A12345',
        '北京|广州',  -- 不同的装货地点
        '广州|深圳',
        '2025-01-20',
        25.5
    ) as result,
    '应该返回false（不同记录）' as expected;

-- 5. 测试重复检测 - 应该返回 false（不同日期）
SELECT 
    '测试3: 重复检测 - 不同日期' as test_case,
    public.check_logistics_record_duplicate_v2(
        '重复检测测试项目',
        '重复检测测试链路',
        '重复检测测试司机',
        '重复检测A12345',
        '北京|上海',
        '广州|深圳',
        '2025-01-21',  -- 不同的日期
        25.5
    ) as result,
    '应该返回false（不同记录）' as expected;

-- 6. 测试地点顺序不影响重复检测
SELECT 
    '测试4: 重复检测 - 地点顺序不同' as test_case,
    public.check_logistics_record_duplicate_v2(
        '重复检测测试项目',
        '重复检测测试链路',
        '重复检测测试司机',
        '重复检测A12345',
        '上海|北京',  -- 地点顺序不同
        '深圳|广州',  -- 地点顺序不同
        '2025-01-20',
        25.5
    ) as result,
    '应该返回true（地点顺序不影响）' as expected;

-- 7. 清理测试数据
DELETE FROM public.logistics_records WHERE project_name = '重复检测测试项目';
DELETE FROM public.drivers WHERE name = '重复检测测试司机';
DELETE FROM public.partner_chains WHERE chain_name = '重复检测测试链路';
DELETE FROM public.projects WHERE name = '重复检测测试项目';
