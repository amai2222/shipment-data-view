-- 测试Excel导入中的其他平台名称和外部运单号字段
-- 验证 batch_import_logistics_records 函数是否正确处理这些字段

DO $$
DECLARE
    test_user_id uuid := '7136e5fd-08ae-47ea-a22b-34c1a1745206'::uuid;
    test_project_id uuid;
    test_driver_id uuid;
    test_chain_id uuid;
    test_location_id uuid;
    test_record_id uuid;
    record_count integer;
    test_records jsonb;
BEGIN
    -- 1. 创建测试项目
    INSERT INTO public.projects (
        id, name, start_date, end_date, manager, 
        loading_address, unloading_address, user_id, created_at
    )
    VALUES (
        gen_random_uuid(),
        'Excel导入平台字段测试项目',
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
        'Excel测试司机',
        '京A99999',
        '13900139000',
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
        'Excel测试装货地点',
        test_user_id,
        NOW()
    )
    RETURNING id INTO test_location_id;
    
    -- 5. 准备测试数据（模拟Excel导入的数据格式）
    test_records := '[
        {
            "project_name": "Excel导入平台字段测试项目",
            "chain_name": "测试链路",
            "driver_name": "Excel测试司机",
            "license_plate": "京A99999",
            "driver_phone": "13900139000",
            "loading_location": "Excel测试装货地点",
            "unloading_location": "Excel测试卸货地点",
            "loading_date": "2025-01-20",
            "unloading_date": "2025-01-20",
            "loading_weight": "50.5",
            "unloading_weight": "50.0",
            "current_cost": "2000.00",
            "extra_cost": "200.00",
            "transport_type": "实际运输",
            "remarks": "Excel导入测试",
            "external_tracking_numbers": [
                {
                    "platform": "货拉拉",
                    "tracking_number": "HL20250120001",
                    "status": "pending",
                    "created_at": "2025-01-20T10:00:00Z"
                },
                {
                    "platform": "满帮",
                    "tracking_number": "MB20250120002",
                    "status": "pending",
                    "created_at": "2025-01-20T11:00:00Z"
                }
            ],
            "other_platform_names": ["运满满", "滴滴货运"]
        }
    ]'::jsonb;
    
    -- 6. 显示测试数据
    RAISE NOTICE '测试数据准备完成:';
    RAISE NOTICE '项目ID: %', test_project_id;
    RAISE NOTICE '司机ID: %', test_driver_id;
    RAISE NOTICE '链路ID: %', test_chain_id;
    RAISE NOTICE '地点ID: %', test_location_id;
    RAISE NOTICE '测试记录: %', test_records;
    
    -- 7. 调用批量导入函数
    DECLARE
        import_result jsonb;
    BEGIN
        SELECT public.batch_import_logistics_records(test_records) INTO import_result;
        
        RAISE NOTICE '导入结果: %', import_result;
        
        -- 检查导入是否成功
        IF (import_result->>'success_count')::integer > 0 THEN
            RAISE NOTICE '导入成功！成功记录数: %', import_result->>'success_count';
        ELSE
            RAISE NOTICE '导入失败！错误记录数: %', import_result->>'error_count';
        END IF;
    END;
    
    -- 8. 验证导入的记录
    SELECT COUNT(*) INTO record_count
    FROM public.logistics_records 
    WHERE project_name = 'Excel导入平台字段测试项目';
    
    IF record_count > 0 THEN
        RAISE NOTICE '找到导入的记录，数量: %', record_count;
        
        -- 显示导入记录的详细信息
        DECLARE
            rec_record RECORD;
        BEGIN
            SELECT id, external_tracking_numbers, other_platform_names
            INTO rec_record
            FROM public.logistics_records 
            WHERE project_name = 'Excel导入平台字段测试项目'
            LIMIT 1;
            
            RAISE NOTICE '导入记录详情:';
            RAISE NOTICE '记录ID: %', rec_record.id;
            RAISE NOTICE '外部运单号: %', rec_record.external_tracking_numbers;
            RAISE NOTICE '其他平台名称: %', rec_record.other_platform_names;
            
            -- 验证外部运单号数据
            IF rec_record.external_tracking_numbers IS NOT NULL THEN
                DECLARE
                    tracking_count integer;
                BEGIN
                    SELECT jsonb_array_length(rec_record.external_tracking_numbers) INTO tracking_count;
                    RAISE NOTICE '外部运单号数量: %', tracking_count;
                    
                    -- 显示每个外部运单号
                    FOR i IN 0..tracking_count-1 LOOP
                        RAISE NOTICE '运单号 %: 平台=%, 号码=%', 
                            i+1,
                            rec_record.external_tracking_numbers->i->>'platform',
                            rec_record.external_tracking_numbers->i->>'tracking_number';
                    END LOOP;
                END;
            ELSE
                RAISE NOTICE '外部运单号字段为空';
            END IF;
            
            -- 验证其他平台名称数据
            IF rec_record.other_platform_names IS NOT NULL THEN
                DECLARE
                    platform_count integer;
                BEGIN
                    SELECT array_length(rec_record.other_platform_names, 1) INTO platform_count;
                    RAISE NOTICE '其他平台名称数量: %', platform_count;
                    RAISE NOTICE '其他平台名称: %', rec_record.other_platform_names;
                END;
            ELSE
                RAISE NOTICE '其他平台名称字段为空';
            END IF;
        END;
    ELSE
        RAISE NOTICE '未找到导入的记录';
    END IF;
    
    -- 9. 清理测试数据
    DELETE FROM public.logistics_records WHERE project_name = 'Excel导入平台字段测试项目';
    DELETE FROM public.drivers WHERE id = test_driver_id;
    DELETE FROM public.locations WHERE id = test_location_id;
    DELETE FROM public.partner_chains WHERE id = test_chain_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    
    RAISE NOTICE '测试数据已清理';
    
END $$;

-- 显示测试完成信息
SELECT 'Excel导入平台字段测试完成' as status;
