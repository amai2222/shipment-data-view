-- 测试验重功能是否正常工作
-- 在Supabase SQL编辑器中执行此脚本来测试

-- 1. 首先查看现有的运单记录（用于测试重复检测）
SELECT 
    project_name,
    chain_id,
    driver_name,
    license_plate,
    loading_location,
    unloading_location,
    loading_date,
    loading_weight,
    created_at
FROM logistics_records 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. 测试验重函数 - 使用现有记录的数据
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "测试项目",
            "chain_name": "",
            "driver_name": "测试司机",
            "license_plate": "测试车牌",
            "driver_phone": "13800138000",
            "loading_location": "测试装货地点",
            "unloading_location": "测试卸货地点",
            "loading_date": "2025-01-20",
            "unloading_date": "2025-01-21",
            "loading_weight": "10.5",
            "unloading_weight": "10.2",
            "current_cost": "5000",
            "extra_cost": "200",
            "transport_type": "实际运输",
            "remarks": "测试备注"
        }
    ]'::jsonb
) as test_result;

-- 3. 如果有现有记录，用现有记录的数据测试重复检测
-- 请将下面的数据替换为实际的运单数据
/*
SELECT public.preview_import_with_duplicates_check(
    '[
        {
            "project_name": "实际项目名称",
            "chain_name": "实际链路名称",
            "driver_name": "实际司机姓名",
            "license_plate": "实际车牌号",
            "driver_phone": "实际电话",
            "loading_location": "实际装货地点",
            "unloading_location": "实际卸货地点",
            "loading_date": "实际装货日期",
            "unloading_date": "实际卸货日期",
            "loading_weight": "实际装货数量",
            "unloading_weight": "实际卸货数量",
            "current_cost": "实际运费",
            "extra_cost": "实际额外费用",
            "transport_type": "实际运输",
            "remarks": "实际备注"
        }
    ]'::jsonb
) as duplicate_test_result;
*/
