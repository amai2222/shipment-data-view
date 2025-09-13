-- 测试现有平台字段的使用
-- 验证 external_tracking_numbers 和 other_platform_names 字段

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
    -- 1. 创建测试项目
    INSERT INTO public.projects (
        id, name, start_date, end_date, manager, 
        loading_address, unloading_address, user_id, created_at
    )
    VALUES (
        gen_random_uuid(),
        '现有字段测试项目',
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
    
    -- 5. 创建测试运单记录（使用现有字段）
    INSERT INTO public.logistics_records (
        id, project_id, chain_id, driver_id, 
        project_name, driver_name,
        loading_location, unloading_location,
        loading_date, unloading_date,
        license_plate, driver_phone,
        loading_weight, unloading_weight,
        transport_type, current_cost, extra_cost,
        auto_number, created_by_user_id, created_at,
        external_tracking_numbers,
        other_platform_names
    )
    VALUES (
        gen_random_uuid(),
        test_project_id,
        test_chain_id,
        test_driver_id,
        '现有字段测试项目',
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
        NOW(),
        '[
            {
                "platform": "货拉拉",
                "tracking_number": "HL20250120001",
                "status": "completed"
            },
            {
                "platform": "满帮",
                "tracking_number": "MB20250120002",
                "status": "in_transit"
            }
        ]'::jsonb,
        ARRAY['运满满', '滴滴货运']
    )
    RETURNING id INTO test_record_id;
    
    -- 6. 显示测试数据ID
    RAISE NOTICE '测试数据创建完成:';
    RAISE NOTICE '项目ID: %', test_project_id;
    RAISE NOTICE '司机ID: %', test_driver_id;
    RAISE NOTICE '链路ID: %', test_chain_id;
    RAISE NOTICE '地点ID: %', test_location_id;
    RAISE NOTICE '运单ID: %', test_record_id;
    
    -- 7. 验证运单记录是否创建成功
    SELECT COUNT(*) INTO record_count
    FROM public.logistics_records 
    WHERE id = test_record_id;
    
    IF record_count > 0 THEN
        RAISE NOTICE '运单记录创建成功，记录数: %', record_count;
        
        -- 8. 显示平台运单信息
        DECLARE
            rec_external_tracking jsonb;
            rec_other_platforms text[];
            external_count integer;
            platform_count integer;
        BEGIN
            SELECT external_tracking_numbers, other_platform_names
            INTO rec_external_tracking, rec_other_platforms
            FROM public.logistics_records 
            WHERE id = test_record_id;
            
            -- 计算外部运单号数量
            SELECT jsonb_array_length(rec_external_tracking) INTO external_count;
            
            -- 计算其他平台数量
            SELECT array_length(rec_other_platforms, 1) INTO platform_count;
            
            RAISE NOTICE '平台运单信息验证:';
            RAISE NOTICE '外部运单号数量: %', external_count;
            RAISE NOTICE '其他平台数量: %', platform_count;
            RAISE NOTICE '外部运单号数据: %', rec_external_tracking;
            RAISE NOTICE '其他平台数据: %', rec_other_platforms;
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
SELECT '现有平台字段测试完成' as status;
