-- 测试平台字段导入功能
-- 验证 external_tracking_numbers 和 other_platform_names 字段是否正确导入

-- 1. 创建测试数据
DO $$
DECLARE
    test_user_id uuid;
    test_project_id uuid;
    test_chain_id uuid;
    test_driver_id uuid;
    test_record_id uuid;
    test_records jsonb;
    preview_result jsonb;
    import_result jsonb;
    inserted_record record;
BEGIN
    -- 获取当前用户ID，如果不存在则使用默认值
    SELECT auth.uid() INTO test_user_id;
    IF test_user_id IS NULL THEN
        test_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- 清理可能存在的测试数据
    DELETE FROM public.logistics_records WHERE project_name = '平台字段测试项目';
    DELETE FROM public.partner_chains WHERE chain_name = '平台字段测试链路';
    DELETE FROM public.drivers WHERE name = '平台字段测试司机';
    DELETE FROM public.projects WHERE name = '平台字段测试项目';

    -- 创建测试项目
    INSERT INTO public.projects (name, start_date, end_date, manager, loading_address, unloading_address, user_id)
    VALUES ('平台字段测试项目', '2025-01-01', '2025-12-31', '测试经理', '测试装货地址', '测试卸货地址', test_user_id)
    RETURNING id INTO test_project_id;

    -- 创建测试合作链路
    INSERT INTO public.partner_chains (project_id, chain_name, description, user_id)
    VALUES (test_project_id, '平台字段测试链路', '测试链路描述', test_user_id)
    RETURNING id INTO test_chain_id;

    -- 创建测试司机
    INSERT INTO public.drivers (name, license_plate, phone, user_id)
    VALUES ('平台字段测试司机', '测试车牌001', '13800138000', test_user_id)
    RETURNING id INTO test_driver_id;

    -- 创建测试数据
    test_records := '[
        {
            "project_name": "平台字段测试项目",
            "chain_name": "平台字段测试链路",
            "driver_name": "平台字段测试司机",
            "license_plate": "测试车牌001",
            "driver_phone": "13800138000",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "2025-01-20",
            "loading_weight": "25.5",
            "current_cost": "1500",
            "extra_cost": "100",
            "transport_type": "实际运输",
            "remarks": "平台字段测试备注",
            "external_tracking_numbers": [
                {
                    "platform": "货拉拉",
                    "tracking_number": "HL20250120001",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                },
                {
                    "platform": "货拉拉",
                    "tracking_number": "HL20250120002",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                },
                {
                    "platform": "满帮",
                    "tracking_number": "MB20250120001",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                }
            ],
            "other_platform_names": ["货拉拉", "满帮", "运满满"]
        }
    ]'::jsonb;

    -- 测试预览功能
    RAISE NOTICE '开始测试预览功能...';
    SELECT public.preview_import_with_duplicates_check(test_records) INTO preview_result;
    RAISE NOTICE '预览结果: %', preview_result;

    -- 测试导入功能
    RAISE NOTICE '开始测试导入功能...';
    SELECT public.batch_import_logistics_records(test_records) INTO import_result;
    RAISE NOTICE '导入结果: %', import_result;

    -- 验证导入的数据
    RAISE NOTICE '开始验证导入的数据...';
    SELECT * INTO inserted_record
    FROM public.logistics_records
    WHERE project_name = '平台字段测试项目'
    AND driver_name = '平台字段测试司机'
    LIMIT 1;

    IF inserted_record.id IS NOT NULL THEN
        RAISE NOTICE '运单记录创建成功，ID: %', inserted_record.id;
        RAISE NOTICE '外部运单号: %', inserted_record.external_tracking_numbers;
        RAISE NOTICE '其他平台名称: %', inserted_record.other_platform_names;
        
        -- 验证平台字段数据
        IF inserted_record.external_tracking_numbers IS NOT NULL AND jsonb_array_length(inserted_record.external_tracking_numbers) > 0 THEN
            RAISE NOTICE '✅ external_tracking_numbers 字段导入成功';
        ELSE
            RAISE NOTICE '❌ external_tracking_numbers 字段导入失败';
        END IF;
        
        IF inserted_record.other_platform_names IS NOT NULL AND array_length(inserted_record.other_platform_names, 1) > 0 THEN
            RAISE NOTICE '✅ other_platform_names 字段导入成功';
        ELSE
            RAISE NOTICE '❌ other_platform_names 字段导入失败';
        END IF;
    ELSE
        RAISE NOTICE '❌ 运单记录创建失败';
    END IF;

    -- 清理测试数据
    DELETE FROM public.logistics_records WHERE project_name = '平台字段测试项目';
    DELETE FROM public.partner_chains WHERE chain_name = '平台字段测试链路';
    DELETE FROM public.drivers WHERE name = '平台字段测试司机';
    DELETE FROM public.projects WHERE name = '平台字段测试项目';

    RAISE NOTICE '测试完成，测试数据已清理';
END $$;

-- 2. 测试多装多卸功能中的平台字段
DO $$
DECLARE
    test_user_id uuid;
    test_project_id uuid;
    test_chain_id uuid;
    test_driver_id uuid;
    test_record_id uuid;
    test_records jsonb;
    preview_result jsonb;
    import_result jsonb;
    inserted_record record;
BEGIN
    -- 获取当前用户ID，如果不存在则使用默认值
    SELECT auth.uid() INTO test_user_id;
    IF test_user_id IS NULL THEN
        test_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- 清理可能存在的测试数据
    DELETE FROM public.logistics_records WHERE project_name = '多装多卸平台字段测试项目';
    DELETE FROM public.partner_chains WHERE chain_name = '多装多卸平台字段测试链路';
    DELETE FROM public.drivers WHERE name = '多装多卸平台字段测试司机';
    DELETE FROM public.projects WHERE name = '多装多卸平台字段测试项目';

    -- 创建测试项目
    INSERT INTO public.projects (name, start_date, end_date, manager, loading_address, unloading_address, user_id)
    VALUES ('多装多卸平台字段测试项目', '2025-01-01', '2025-12-31', '测试经理', '测试装货地址', '测试卸货地址', test_user_id)
    RETURNING id INTO test_project_id;

    -- 创建测试合作链路
    INSERT INTO public.partner_chains (project_id, chain_name, description, user_id)
    VALUES (test_project_id, '多装多卸平台字段测试链路', '测试链路描述', test_user_id)
    RETURNING id INTO test_chain_id;

    -- 创建测试司机
    INSERT INTO public.drivers (name, license_plate, phone, user_id)
    VALUES ('多装多卸平台字段测试司机', '测试车牌002', '13800138001', test_user_id)
    RETURNING id INTO test_driver_id;

    -- 创建多装多卸测试数据
    test_records := '[
        {
            "project_name": "多装多卸平台字段测试项目",
            "chain_name": "多装多卸平台字段测试链路",
            "driver_name": "多装多卸平台字段测试司机",
            "license_plate": "测试车牌002",
            "driver_phone": "13800138001",
            "loading_location": "北京仓库|天津仓库",
            "unloading_location": "上海仓库|苏州仓库",
            "loading_date": "2025-01-20",
            "loading_weight": "50.0",
            "current_cost": "3000",
            "extra_cost": "200",
            "transport_type": "实际运输",
            "remarks": "多装多卸平台字段测试备注",
            "external_tracking_numbers": [
                {
                    "platform": "货拉拉",
                    "tracking_number": "HL20250120003",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                },
                {
                    "platform": "满帮",
                    "tracking_number": "MB20250120002",
                    "status": "pending",
                    "created_at": "2025-01-20T08:00:00Z"
                }
            ],
            "other_platform_names": ["货拉拉", "满帮"]
        }
    ]'::jsonb;

    -- 测试预览功能
    RAISE NOTICE '开始测试多装多卸预览功能...';
    SELECT public.preview_import_with_duplicates_check(test_records) INTO preview_result;
    RAISE NOTICE '多装多卸预览结果: %', preview_result;

    -- 测试导入功能
    RAISE NOTICE '开始测试多装多卸导入功能...';
    SELECT public.batch_import_logistics_records(test_records) INTO import_result;
    RAISE NOTICE '多装多卸导入结果: %', import_result;

    -- 验证导入的数据
    RAISE NOTICE '开始验证多装多卸导入的数据...';
    SELECT * INTO inserted_record
    FROM public.logistics_records
    WHERE project_name = '多装多卸平台字段测试项目'
    AND driver_name = '多装多卸平台字段测试司机'
    LIMIT 1;

    IF inserted_record.id IS NOT NULL THEN
        RAISE NOTICE '多装多卸运单记录创建成功，ID: %', inserted_record.id;
        RAISE NOTICE '装货地点: %', inserted_record.loading_location;
        RAISE NOTICE '卸货地点: %', inserted_record.unloading_location;
        RAISE NOTICE '外部运单号: %', inserted_record.external_tracking_numbers;
        RAISE NOTICE '其他平台名称: %', inserted_record.other_platform_names;
        
        -- 验证多装多卸和平台字段数据
        IF inserted_record.loading_location LIKE '%|%' AND inserted_record.unloading_location LIKE '%|%' THEN
            RAISE NOTICE '✅ 多装多卸功能正常';
        ELSE
            RAISE NOTICE '❌ 多装多卸功能异常';
        END IF;
        
        IF inserted_record.external_tracking_numbers IS NOT NULL AND jsonb_array_length(inserted_record.external_tracking_numbers) > 0 THEN
            RAISE NOTICE '✅ 多装多卸 external_tracking_numbers 字段导入成功';
        ELSE
            RAISE NOTICE '❌ 多装多卸 external_tracking_numbers 字段导入失败';
        END IF;
        
        IF inserted_record.other_platform_names IS NOT NULL AND array_length(inserted_record.other_platform_names, 1) > 0 THEN
            RAISE NOTICE '✅ 多装多卸 other_platform_names 字段导入成功';
        ELSE
            RAISE NOTICE '❌ 多装多卸 other_platform_names 字段导入失败';
        END IF;
    ELSE
        RAISE NOTICE '❌ 多装多卸运单记录创建失败';
    END IF;

    -- 清理测试数据
    DELETE FROM public.logistics_records WHERE project_name = '多装多卸平台字段测试项目';
    DELETE FROM public.partner_chains WHERE chain_name = '多装多卸平台字段测试链路';
    DELETE FROM public.drivers WHERE name = '多装多卸平台字段测试司机';
    DELETE FROM public.projects WHERE name = '多装多卸平台字段测试项目';

    RAISE NOTICE '多装多卸测试完成，测试数据已清理';
END $$;

-- 3. 显示测试结果总结
SELECT 
    '平台字段导入功能测试完成' as test_status,
    '请检查上述输出中的 ✅ 和 ❌ 标记' as result_note,
    '如果所有标记都是 ✅，说明平台字段导入功能正常' as success_criteria;
