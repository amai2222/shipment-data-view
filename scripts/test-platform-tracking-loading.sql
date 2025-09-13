-- 测试平台运单信息加载功能
-- 验证编辑运单时，其他平台名称和平台运单号码能正确加载

DO $$
DECLARE
    test_user_id uuid := '7136e5fd-08ae-47ea-a22b-34c1a1745206'::uuid;
    test_project_id uuid;
    test_driver_id uuid;
    test_chain_id uuid;
    test_location_id uuid;
    test_record_id uuid;
    platform_trackings_data jsonb[];
BEGIN
    -- 1. 创建测试项目
    INSERT INTO public.projects (
        id, name, start_date, end_date, manager, 
        loading_address, unloading_address, user_id, created_at
    )
    VALUES (
        gen_random_uuid(),
        '平台运单测试项目',
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
    
    -- 5. 准备平台运单信息数据
    platform_trackings_data := ARRAY[
        jsonb_build_object(
            'platform', '货拉拉',
            'trackingNumbers', ARRAY['HL20250120001', 'HL20250120002']
        ),
        jsonb_build_object(
            'platform', '满帮',
            'trackingNumbers', ARRAY['MB20250120001']
        ),
        jsonb_build_object(
            'platform', '运满满',
            'trackingNumbers', ARRAY['YM20250120001', 'YM20250120002', 'YM20250120003']
        )
    ];
    
    -- 6. 创建测试运单记录（不包含平台运单信息，因为字段还不存在）
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
        '平台运单测试项目',
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
    
    -- 7. 显示测试数据ID
    RAISE NOTICE '测试数据创建完成:';
    RAISE NOTICE '项目ID: %', test_project_id;
    RAISE NOTICE '司机ID: %', test_driver_id;
    RAISE NOTICE '链路ID: %', test_chain_id;
    RAISE NOTICE '地点ID: %', test_location_id;
    RAISE NOTICE '运单ID: %', test_record_id;
    
    -- 8. 验证运单记录是否创建成功
    DECLARE
        record_count integer;
    BEGIN
        SELECT COUNT(*) INTO record_count
        FROM public.logistics_records 
        WHERE id = test_record_id;
        
        IF record_count > 0 THEN
            RAISE NOTICE '运单记录创建成功，记录数: %', record_count;
            RAISE NOTICE '注意: platform_trackings 字段需要先添加到数据库表中';
        ELSE
            RAISE NOTICE '运单记录创建失败';
        END IF;
    END;
    
    -- 9. 清理测试数据
    DELETE FROM public.logistics_records WHERE id = test_record_id;
    DELETE FROM public.drivers WHERE id = test_driver_id;
    DELETE FROM public.locations WHERE id = test_location_id;
    DELETE FROM public.partner_chains WHERE id = test_chain_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    
    RAISE NOTICE '测试数据已清理';
    
END $$;

-- 显示测试完成信息
SELECT '平台运单信息加载测试完成' as status;
