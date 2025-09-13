-- 测试运单编辑数据填充修复
-- 使用提供的用户ID进行测试

DO $$
DECLARE
    test_user_id uuid := '7136e5fd-08ae-47ea-a22b-34c1a1745206'::uuid;
    test_project_id uuid;
    test_driver_id uuid;
    test_chain_id uuid;
    test_location_id uuid;
    test_record_id uuid;
BEGIN
    -- 1. 创建测试项目
    INSERT INTO public.projects (
        id, name, start_date, end_date, manager, 
        loading_address, unloading_address, user_id, created_at
    )
    VALUES (
        gen_random_uuid(),
        '运单编辑测试项目',
        '2025-01-01'::date,
        '2025-12-31'::date,
        '测试管理员',
        '测试装货地址',
        '测试卸货地址',
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_project_id;
    
    -- 2. 创建测试合作链路
    INSERT INTO public.partner_chains (id, project_id, chain_name, is_default, user_id, created_at)
    VALUES (
        gen_random_uuid(),
        test_project_id,
        '测试链路',
        true,
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_chain_id;
    
    -- 3. 创建测试司机
    INSERT INTO public.drivers (id, name, license_plate, phone, user_id, created_at)
    VALUES (
        gen_random_uuid(),
        '测试司机',
        '京A12345',
        '13800138000',
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_driver_id;
    
    -- 4. 创建测试地点
    INSERT INTO public.locations (id, name, user_id, created_at)
    VALUES (
        gen_random_uuid(),
        '测试装货地点',
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_location_id;
    
    -- 5. 创建测试运单记录
    INSERT INTO public.logistics_records (
        id, project_id, chain_id, driver_id, 
        loading_location, unloading_location,
        loading_date, unloading_date,
        license_plate, driver_phone,
        loading_weight, unloading_weight,
        transport_type, current_cost, extra_cost,
        auto_number, created_by_user_id, created_at
    )
    VALUES (
        gen_random_uuid(),
        test_project_id,
        test_chain_id,
        test_driver_id,
        '测试装货地点|另一个装货地点',
        '测试卸货地点|另一个卸货地点',
        '2025-01-20 08:00:00+08'::timestamptz,
        '2025-01-20 18:00:00+08'::timestamptz,
        '京A12345',
        '13800138000',
        42.5,
        42.0,
        '实际运输',
        1000.00,
        100.00,
        public.generate_auto_number('2025-01-20'),
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_record_id;
    
    -- 6. 显示测试数据
    RAISE NOTICE '测试数据创建完成:';
    RAISE NOTICE '项目ID: %', test_project_id;
    RAISE NOTICE '司机ID: %', test_driver_id;
    RAISE NOTICE '链路ID: %', test_chain_id;
    RAISE NOTICE '地点ID: %', test_location_id;
    RAISE NOTICE '运单ID: %', test_record_id;
    
    -- 7. 查询创建的运单记录
    RAISE NOTICE '运单记录详情:';
    DECLARE
        rec_id uuid;
        rec_project_id uuid;
        rec_chain_id uuid;
        rec_driver_id uuid;
        rec_loading_location text;
        rec_unloading_location text;
        rec_loading_date timestamptz;
        rec_unloading_date timestamptz;
        rec_license_plate text;
        rec_driver_phone text;
        rec_loading_weight numeric;
        rec_unloading_weight numeric;
        rec_transport_type text;
        rec_current_cost numeric;
        rec_extra_cost numeric;
    BEGIN
        SELECT 
            id, project_id, chain_id, driver_id,
            loading_location, unloading_location,
            loading_date, unloading_date,
            license_plate, driver_phone,
            loading_weight, unloading_weight,
            transport_type, current_cost, extra_cost
        INTO 
            rec_id, rec_project_id, rec_chain_id, rec_driver_id,
            rec_loading_location, rec_unloading_location,
            rec_loading_date, rec_unloading_date,
            rec_license_plate, rec_driver_phone,
            rec_loading_weight, rec_unloading_weight,
            rec_transport_type, rec_current_cost, rec_extra_cost
        FROM public.logistics_records 
        WHERE id = test_record_id;
        
        RAISE NOTICE 'ID: %', rec_id;
        RAISE NOTICE '项目ID: %', rec_project_id;
        RAISE NOTICE '链路ID: %', rec_chain_id;
        RAISE NOTICE '司机ID: %', rec_driver_id;
        RAISE NOTICE '装货地点: %', rec_loading_location;
        RAISE NOTICE '卸货地点: %', rec_unloading_location;
        RAISE NOTICE '装货日期: %', rec_loading_date;
        RAISE NOTICE '卸货日期: %', rec_unloading_date;
        RAISE NOTICE '车牌号: %', rec_license_plate;
        RAISE NOTICE '司机电话: %', rec_driver_phone;
        RAISE NOTICE '装货重量: %', rec_loading_weight;
        RAISE NOTICE '卸货重量: %', rec_unloading_weight;
        RAISE NOTICE '运输类型: %', rec_transport_type;
        RAISE NOTICE '运费: %', rec_current_cost;
        RAISE NOTICE '额外费: %', rec_extra_cost;
    END;
    
    -- 8. 清理测试数据
    DELETE FROM public.logistics_records WHERE id = test_record_id;
    DELETE FROM public.drivers WHERE id = test_driver_id;
    DELETE FROM public.locations WHERE id = test_location_id;
    DELETE FROM public.partner_chains WHERE id = test_chain_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    
    RAISE NOTICE '测试数据已清理';
    
END $$;

-- 显示测试完成信息
SELECT '运单编辑数据填充修复测试完成' as status;
