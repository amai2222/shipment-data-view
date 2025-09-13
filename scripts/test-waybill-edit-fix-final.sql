-- 最终版运单编辑数据填充修复测试
-- 使用提供的用户ID进行测试，确保所有NOT NULL约束都满足

DO $$
DECLARE
    test_user_id uuid := '7136e5fd-08ae-47ea-a22b-34c1a1745206'::uuid;
    test_project_id uuid;
    test_driver_id uuid;
    test_chain_id uuid;
    test_location_id uuid;
    test_record_id uuid;
    record_count integer;
BEGIN
    -- 1. 创建测试项目（包含所有必需字段）
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
    
    -- 2. 创建测试合作链路（移除billing_type_id字段）
    INSERT INTO public.partner_chains (
        id, project_id, chain_name, is_default, user_id, created_at
    )
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
    INSERT INTO public.drivers (
        id, name, license_plate, phone, user_id, created_at
    )
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
    INSERT INTO public.locations (
        id, name, user_id, created_at
    )
    VALUES (
        gen_random_uuid(),
        '测试装货地点',
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_location_id;
    
    -- 5. 创建测试运单记录（包含所有必需字段）
    INSERT INTO public.logistics_records (
        id, project_id, chain_id, driver_id, 
        project_name, driver_name,
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
        '运单编辑测试项目',
        '测试司机',
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
    
    -- 6. 显示测试数据ID
    RAISE NOTICE '测试数据创建完成:';
    RAISE NOTICE '项目ID: %', test_project_id;
    RAISE NOTICE '司机ID: %', test_driver_id;
    RAISE NOTICE '链路ID: %', test_chain_id;
    RAISE NOTICE '地点ID: %', test_location_id;
    RAISE NOTICE '运单ID: %', test_record_id;
    
    -- 7. 验证运单记录是否存在
    SELECT COUNT(*) INTO record_count
    FROM public.logistics_records 
    WHERE id = test_record_id;
    
    IF record_count > 0 THEN
        RAISE NOTICE '运单记录创建成功，记录数: %', record_count;
        
        -- 8. 显示运单记录的关键信息
        DECLARE
            rec_project_name text;
            rec_driver_name text;
            rec_loading_location text;
            rec_unloading_location text;
            rec_license_plate text;
            rec_driver_phone text;
        BEGIN
            SELECT 
                project_name, driver_name, loading_location, unloading_location,
                license_plate, driver_phone
            INTO 
                rec_project_name, rec_driver_name, rec_loading_location, rec_unloading_location,
                rec_license_plate, rec_driver_phone
            FROM public.logistics_records 
            WHERE id = test_record_id;
            
            RAISE NOTICE '运单记录详情:';
            RAISE NOTICE '项目名称: %', rec_project_name;
            RAISE NOTICE '司机姓名: %', rec_driver_name;
            RAISE NOTICE '装货地点: %', rec_loading_location;
            RAISE NOTICE '卸货地点: %', rec_unloading_location;
            RAISE NOTICE '车牌号: %', rec_license_plate;
            RAISE NOTICE '司机电话: %', rec_driver_phone;
        END;
    ELSE
        RAISE NOTICE '运单记录创建失败';
    END IF;
    
    -- 9. 清理测试数据
    DELETE FROM public.logistics_records WHERE id = test_record_id;
    DELETE FROM public.drivers WHERE id = test_driver_id;
    DELETE FROM public.locations WHERE id = test_location_id;
    DELETE FROM public.partner_chains WHERE id = test_chain_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    
    RAISE NOTICE '测试数据已清理';
    
END $$;

-- 显示测试完成信息
SELECT '运单编辑数据填充修复测试完成' as status;
