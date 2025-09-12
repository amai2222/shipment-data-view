-- 测试增强的日期格式支持
-- 验证各种日期格式是否能正确解析和验重

-- 1. 测试各种日期格式的解析
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机1",
            "license_plate": "测试车牌1",
            "driver_phone": "13800138000",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "2025-01-21",
            "unloading_date": "2025-01-22",
            "loading_weight": "10.5",
            "unloading_weight": "10.2",
            "current_cost": "5000",
            "extra_cost": "200",
            "transport_type": "实际运输",
            "remarks": "标准格式测试"
        },
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机2",
            "license_plate": "测试车牌2",
            "driver_phone": "13800138001",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "5月20日",
            "unloading_date": "5月21日",
            "loading_weight": "15.0",
            "unloading_weight": "14.8",
            "current_cost": "6000",
            "extra_cost": "300",
            "transport_type": "实际运输",
            "remarks": "中文格式测试"
        },
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机3",
            "license_plate": "测试车牌3",
            "driver_phone": "13800138002",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "2025年12月25日",
            "unloading_date": "2025年12月26日",
            "loading_weight": "20.0",
            "unloading_weight": "19.5",
            "current_cost": "7000",
            "extra_cost": "400",
            "transport_type": "实际运输",
            "remarks": "完整中文格式测试"
        },
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机4",
            "license_plate": "测试车牌4",
            "driver_phone": "13800138003",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "3/15",
            "unloading_date": "3/16",
            "loading_weight": "25.0",
            "unloading_weight": "24.8",
            "current_cost": "8000",
            "extra_cost": "500",
            "transport_type": "实际运输",
            "remarks": "简化格式测试"
        },
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机5",
            "license_plate": "测试车牌5",
            "driver_phone": "13800138004",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "12-25",
            "unloading_date": "12-26",
            "loading_weight": "30.0",
            "unloading_weight": "29.5",
            "current_cost": "9000",
            "extra_cost": "600",
            "transport_type": "实际运输",
            "remarks": "横线格式测试"
        }
    ]'::jsonb
) as test_result;

-- 2. 测试重复检测（使用相同的日期格式）
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机1",
            "license_plate": "测试车牌1",
            "driver_phone": "13800138000",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "2025-01-21",
            "unloading_date": "2025-01-22",
            "loading_weight": "10.5",
            "unloading_weight": "10.2",
            "current_cost": "5000",
            "extra_cost": "200",
            "transport_type": "实际运输",
            "remarks": "重复测试"
        }
    ]'::jsonb
) as duplicate_test_result;

-- 3. 测试错误日期格式
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机6",
            "license_plate": "测试车牌6",
            "driver_phone": "13800138005",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "无效日期格式",
            "unloading_date": "2025-01-22",
            "loading_weight": "35.0",
            "unloading_weight": "34.5",
            "current_cost": "10000",
            "extra_cost": "700",
            "transport_type": "实际运输",
            "remarks": "错误格式测试"
        }
    ]'::jsonb
) as error_test_result;
