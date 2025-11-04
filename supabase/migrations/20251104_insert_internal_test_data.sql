-- ============================================================================
-- 内部车辆管理系统 - 测试数据
-- ============================================================================
-- 功能：插入测试数据用于开发和演示
-- 包含：车队长账号、司机账号、内部司机、内部车辆、关联关系
-- 创建时间：2025-11-04
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：创建测试用户账号
-- ==========================================

-- 注意：这里只更新 profiles 表
-- 实际登录密码需要在 Supabase Dashboard 的 Authentication 中设置

-- 1. 车队长账号（假设已有用户，只更新角色）
-- 如果需要新建用户，请在 Supabase Dashboard 中操作
-- 这里仅提供 UPDATE 示例

-- UPDATE profiles SET 
--     role = 'fleet_manager',
--     full_name = '车队长-张伟',
--     phone = '13900000001'
-- WHERE email = 'fleet_manager@test.com';

-- 2. 司机账号示例
-- UPDATE profiles SET 
--     role = 'driver',
--     full_name = '司机-王师傅',
--     phone = '13900000002'
-- WHERE email = 'driver@test.com';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️ 测试账号说明';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '请在 Supabase Dashboard 中手动创建以下测试账号：';
    RAISE NOTICE '';
    RAISE NOTICE '1. 车队长账号：';
    RAISE NOTICE '   Email: fleet_manager@test.com';
    RAISE NOTICE '   Password: FleetManager123!';
    RAISE NOTICE '   创建后执行：';
    RAISE NOTICE '   UPDATE profiles SET role = ''fleet_manager'', full_name = ''车队长-张伟'' WHERE email = ''fleet_manager@test.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '2. 司机账号：';
    RAISE NOTICE '   Email: driver@test.com';
    RAISE NOTICE '   Password: Driver123!';
    RAISE NOTICE '   创建后执行：';
    RAISE NOTICE '   UPDATE profiles SET role = ''driver'', full_name = ''司机-王师傅'' WHERE email = ''driver@test.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 第二步：插入内部司机测试数据（5个司机）
-- ==========================================

INSERT INTO internal_drivers (
    name, 
    phone, 
    id_card_number,
    hire_date,
    employment_status,
    -- 司机证件照片（示例URL，实际使用时需替换为真实的七牛云URL）
    id_card_photos,
    driver_license_photos,
    qualification_certificate_photos,
    -- 证件有效期
    id_card_expire_date,
    driver_license_expire_date,
    qualification_certificate_expire_date,
    -- 工资信息
    base_salary,
    salary_calculation_type,
    commission_rate,
    -- 银行信息
    bank_account,
    bank_name,
    account_holder_name,
    -- 状态
    is_active,
    remarks
) VALUES 
-- 司机1：王师傅（月薪制）
(
    '王师傅',
    '13800001111',
    '530101198501011234',
    '2024-01-15',
    'active',
    '["https://cdn.example.com/driver/身份证-王师傅-1730880000000-1.jpg", "https://cdn.example.com/driver/身份证-王师傅-1730880000000-2.jpg"]'::jsonb,
    '["https://cdn.example.com/driver/驾驶证-王师傅-1730880000000-1.jpg"]'::jsonb,
    '["https://cdn.example.com/driver/资格证-王师傅-1730880000000-1.jpg"]'::jsonb,
    '2030-12-31',
    '2028-06-30',
    '2027-03-15',
    6000.00,
    'monthly',
    NULL,
    '6222021234567890123',
    '中国工商银行昆明分行',
    '王师傅',
    true,
    '主力司机，驾龄10年，熟悉省内线路'
),
-- 司机2：李师傅（计次制+提成）
(
    '李师傅',
    '13800002222',
    '530101198703021456',
    '2024-02-20',
    'active',
    '["https://cdn.example.com/driver/身份证-李师傅-1730880000001-1.jpg"]'::jsonb,
    '["https://cdn.example.com/driver/驾驶证-李师傅-1730880000001-1.jpg"]'::jsonb,
    '["https://cdn.example.com/driver/资格证-李师傅-1730880000001-1.jpg"]'::jsonb,
    '2032-05-20',
    '2029-08-15',
    '2028-02-20',
    4000.00,
    'trip_based',
    15.00,
    '6222021234567890456',
    '中国建设银行昆明分行',
    '李师傅',
    true,
    '擅长长途运输'
),
-- 司机3：张师傅（月薪制）
(
    '张师傅',
    '13800003333',
    '530101199002151789',
    '2024-03-10',
    'active',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '2033-06-30',
    '2030-12-31',
    '2029-03-10',
    5500.00,
    'monthly',
    NULL,
    '6222021234567890789',
    '中国农业银行昆明分行',
    '张师傅',
    true,
    NULL
),
-- 司机4：赵师傅（提成制）
(
    '赵师傅',
    '13800004444',
    '530101198805251234',
    '2024-04-01',
    'active',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '2035-08-20',
    '2031-05-15',
    '2030-04-01',
    3500.00,
    'commission',
    20.00,
    '6222021234567891011',
    '中国银行昆明分行',
    '赵师傅',
    true,
    '新手司机，正在培训中'
),
-- 司机5：刘师傅（请假状态）
(
    '刘师傅',
    '13800005555',
    '530101198207101567',
    '2023-12-01',
    'on_leave',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '2028-12-31',
    '2027-07-15',
    '2026-12-01',
    6500.00,
    'monthly',
    NULL,
    '6222021234567891213',
    '招商银行昆明分行',
    '刘师傅',
    false,
    '目前请假中，预计下月返岗'
);

-- ==========================================
-- 第三步：插入内部车辆测试数据（6辆车）
-- ==========================================

INSERT INTO internal_vehicles (
    license_plate,
    vehicle_number,
    vehicle_type,
    vehicle_brand,
    vehicle_model,
    vehicle_color,
    manufacture_year,
    -- 规格
    load_capacity,
    vehicle_length,
    vehicle_width,
    vehicle_height,
    fuel_type,
    -- 车辆证件照片（示例URL）
    driving_license_photos,
    transport_license_photos,
    vehicle_photos,
    insurance_certificate_photos,
    -- 证件信息
    vin,
    engine_number,
    driving_license_number,
    transport_license_number,
    -- 证件有效期
    driving_license_expire_date,
    transport_license_expire_date,
    annual_inspection_date,
    -- 保险信息
    insurance_company,
    insurance_policy_number,
    insurance_type,
    insurance_amount,
    insurance_start_date,
    insurance_expire_date,
    -- 购车信息
    purchase_date,
    purchase_price,
    purchase_type,
    -- 维保信息
    last_maintenance_date,
    next_maintenance_date,
    current_mileage,
    -- 状态
    vehicle_status,
    is_active,
    remarks
) VALUES 
-- 车辆1：云F97310（完整数据）
(
    '云F97310',
    'V001',
    '厢式货车',
    '东风',
    '天龙KL',
    '白色',
    2020,
    9.60,
    7.60,
    2.40,
    2.80,
    'diesel',
    '["https://cdn.example.com/Truck/行驶证-云F97310-1730880000000-1.jpg", "https://cdn.example.com/Truck/行驶证-云F97310-1730880000000-2.jpg"]'::jsonb,
    '["https://cdn.example.com/Truck/运输证-云F97310-1730880000000-1.jpg"]'::jsonb,
    '["https://cdn.example.com/Truck/车辆-云F97310-前-1730880000000.jpg", "https://cdn.example.com/Truck/车辆-云F97310-后-1730880000000.jpg", "https://cdn.example.com/Truck/车辆-云F97310-左-1730880000000.jpg", "https://cdn.example.com/Truck/车辆-云F97310-右-1730880000000.jpg"]'::jsonb,
    '["https://cdn.example.com/Truck/保险-云F97310-1730880000000-1.jpg"]'::jsonb,
    'LGAX3B246KA123456',
    'DF480E001234',
    '云123456789',
    '运530100001',
    '2025-12-31',
    '2026-06-30',
    '2025-11-30',
    '中国人保财险云南分公司',
    'PICC20250001',
    '交强险+商业险',
    1000000.00,
    '2025-01-01',
    '2026-01-01',
    '2020-03-15',
    280000.00,
    'purchase',
    '2025-10-15',
    '2026-01-15',
    125000,
    'active',
    true,
    '主力车辆，状态良好'
),
-- 车辆2：云F88520（部分数据）
(
    '云F88520',
    'V002',
    '平板车',
    '解放',
    'J6P',
    '蓝色',
    2021,
    12.50,
    9.60,
    2.50,
    2.60,
    'diesel',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'LGAX3B246KB234567',
    'CA6DF3001234',
    '云234567890',
    '运530100002',
    '2026-08-31',
    '2027-03-15',
    '2025-12-15',
    '太平洋保险云南分公司',
    'CPIC20250002',
    '交强险+商业险',
    1200000.00,
    '2025-02-01',
    '2026-02-01',
    '2021-06-20',
    320000.00,
    'purchase',
    '2025-09-20',
    '2025-12-20',
    98000,
    'active',
    true,
    '适合重型货物运输'
),
-- 车辆3：云F66789（厢式货车）
(
    '云F66789',
    'V003',
    '厢式货车',
    '福田',
    '欧曼ETX',
    '白色',
    2022,
    8.00,
    6.80,
    2.30,
    2.70,
    'diesel',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'LGAX3B246KC345678',
    'BF480E002345',
    '云345678901',
    '运530100003',
    '2027-03-31',
    '2027-12-31',
    '2026-02-28',
    '平安保险云南分公司',
    'PING20250003',
    '交强险',
    800000.00,
    '2025-03-01',
    '2026-03-01',
    '2022-04-10',
    260000.00,
    'purchase',
    '2025-08-10',
    '2025-11-10',
    75000,
    'active',
    true,
    '中型车辆，适合市内配送'
),
-- 车辆4：云F55123（冷藏车）
(
    '云F55123',
    'V004',
    '冷藏车',
    '江淮',
    '骏铃V6',
    '银灰色',
    2023,
    5.00,
    5.20,
    2.10,
    2.50,
    'diesel',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'LGAX3B246KD456789',
    'JH480E003456',
    '云456789012',
    '运530100004',
    '2028-06-30',
    '2028-12-31',
    '2026-08-31',
    '人保财险云南分公司',
    'PICC20250004',
    '交强险+商业险+冷链险',
    900000.00,
    '2025-04-01',
    '2026-04-01',
    '2023-05-15',
    380000.00,
    'finance',
    '2025-07-15',
    '2025-10-15',
    45000,
    'active',
    true,
    '冷藏车，配备制冷设备，适合生鲜运输'
),
-- 车辆5：云F33456（维修中）
(
    '云F33456',
    'V005',
    '平板车',
    '重汽',
    '豪沃T7H',
    '红色',
    2019,
    15.00,
    12.00,
    2.55,
    2.80,
    'diesel',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'LGAX3B246KE567890',
    'WD480E004567',
    '云567890123',
    '运530100005',
    '2025-09-30',
    '2026-01-31',
    '2025-11-15',
    '太平洋保险云南分公司',
    'CPIC20250005',
    '交强险+商业险',
    1500000.00,
    '2025-05-01',
    '2026-05-01',
    '2019-08-20',
    450000.00,
    'purchase',
    '2025-10-20',
    '2025-11-20',
    180000,
    'maintenance',  -- ⚠️ 维修中
    true,
    '发动机故障，预计维修3天'
),
-- 车辆6：云F22789（新车）
(
    '云F22789',
    'V006',
    '厢式货车',
    '陕汽',
    '德龙X6000',
    '蓝色',
    2024,
    10.00,
    8.60,
    2.50,
    2.90,
    'electric',  -- 电动车
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'LGAX3B246KF678901',
    'SX480E005678',
    '云678901234',
    '运530100006',
    '2029-12-31',
    '2029-12-31',
    '2027-12-31',
    '平安保险云南分公司',
    'PING20250006',
    '交强险+商业险+新能源专项险',
    1200000.00,
    '2025-06-01',
    '2026-06-01',
    '2024-07-01',
    520000.00,
    'lease',  -- 租赁
    '2025-09-01',
    '2025-12-01',
    8500,
    'active',
    true,
    '新能源车辆，租赁3年'
);

-- ==========================================
-- 第四步：建立司机-车辆关联关系
-- ==========================================

-- 1. 王师傅 → 云F97310（主驾驶）
INSERT INTO internal_driver_vehicle_relations (
    driver_id,
    vehicle_id,
    is_primary,
    relation_type,
    valid_from
) VALUES (
    (SELECT id FROM internal_drivers WHERE name = '王师傅'),
    (SELECT id FROM internal_vehicles WHERE license_plate = '云F97310'),
    true,
    'regular',
    '2024-01-15'
);

-- 2. 王师傅 → 云F66789（备用车）
INSERT INTO internal_driver_vehicle_relations (
    driver_id,
    vehicle_id,
    is_primary,
    relation_type,
    valid_from
) VALUES (
    (SELECT id FROM internal_drivers WHERE name = '王师傅'),
    (SELECT id FROM internal_vehicles WHERE license_plate = '云F66789'),
    false,
    'backup',
    '2024-03-01'
);

-- 3. 李师傅 → 云F88520（主驾驶）
INSERT INTO internal_driver_vehicle_relations (
    driver_id,
    vehicle_id,
    is_primary,
    relation_type,
    valid_from
) VALUES (
    (SELECT id FROM internal_drivers WHERE name = '李师傅'),
    (SELECT id FROM internal_vehicles WHERE license_plate = '云F88520'),
    true,
    'regular',
    '2024-02-20'
);

-- 4. 张师傅 → 云F66789（主驾驶）
INSERT INTO internal_driver_vehicle_relations (
    driver_id,
    vehicle_id,
    is_primary,
    relation_type,
    valid_from
) VALUES (
    (SELECT id FROM internal_drivers WHERE name = '张师傅'),
    (SELECT id FROM internal_vehicles WHERE license_plate = '云F66789'),
    true,
    'regular',
    '2024-03-10'
);

-- 5. 赵师傅 → 云F55123（主驾驶）
INSERT INTO internal_driver_vehicle_relations (
    driver_id,
    vehicle_id,
    is_primary,
    relation_type,
    valid_from
) VALUES (
    (SELECT id FROM internal_drivers WHERE name = '赵师傅'),
    (SELECT id FROM internal_vehicles WHERE license_plate = '云F55123'),
    true,
    'regular',
    '2024-04-01'
);

-- 6. 李师傅 → 云F22789（临时驾驶，新车交接中）
INSERT INTO internal_driver_vehicle_relations (
    driver_id,
    vehicle_id,
    is_primary,
    relation_type,
    valid_from,
    valid_until
) VALUES (
    (SELECT id FROM internal_drivers WHERE name = '李师傅'),
    (SELECT id FROM internal_vehicles WHERE license_plate = '云F22789'),
    false,
    'temporary',
    '2024-07-01',
    '2024-08-31'
);

-- ==========================================
-- 第五步：验证数据插入
-- ==========================================

DO $$
DECLARE
    v_driver_count INTEGER;
    v_vehicle_count INTEGER;
    v_relation_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_driver_count FROM internal_drivers;
    SELECT COUNT(*) INTO v_vehicle_count FROM internal_vehicles;
    SELECT COUNT(*) INTO v_relation_count FROM internal_driver_vehicle_relations;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 测试数据插入完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '数据统计：';
    RAISE NOTICE '  - 内部司机: % 个', v_driver_count;
    RAISE NOTICE '  - 内部车辆: % 辆', v_vehicle_count;
    RAISE NOTICE '  - 关联关系: % 条', v_relation_count;
    RAISE NOTICE '';
    RAISE NOTICE '司机列表：';
    RAISE NOTICE '  1. 王师傅 (主车: 云F97310, 备用: 云F66789)';
    RAISE NOTICE '  2. 李师傅 (主车: 云F88520, 临时: 云F22789)';
    RAISE NOTICE '  3. 张师傅 (主车: 云F66789)';
    RAISE NOTICE '  4. 赵师傅 (主车: 云F55123)';
    RAISE NOTICE '  5. 刘师傅 (请假中)';
    RAISE NOTICE '';
    RAISE NOTICE '车辆列表：';
    RAISE NOTICE '  1. 云F97310 - 东风天龙 (王师傅主驾)';
    RAISE NOTICE '  2. 云F88520 - 解放J6P (李师傅主驾)';
    RAISE NOTICE '  3. 云F66789 - 福田欧曼 (张师傅主驾, 王师傅备用)';
    RAISE NOTICE '  4. 云F55123 - 江淮骏铃 冷藏车 (赵师傅主驾)';
    RAISE NOTICE '  5. 云F33456 - 重汽豪沃 ⚠️维修中';
    RAISE NOTICE '  6. 云F22789 - 陕汽德龙 电动车 租赁 (李师傅临时)';
    RAISE NOTICE '';
    RAISE NOTICE '特殊场景：';
    RAISE NOTICE '  ✅ 一司机多车：王师傅驾驶2辆车（主+备用）';
    RAISE NOTICE '  ✅ 多司机共车：云F66789 有2个司机（张师傅主, 王师傅备）';
    RAISE NOTICE '  ✅ 临时关联：李师傅临时驾驶新车（有有效期）';
    RAISE NOTICE '  ⚠️ 维修状态：云F33456 维修中';
    RAISE NOTICE '  🔴 请假状态：刘师傅请假中';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 第六步：查询测试数据
-- ==========================================

-- 1. 查看所有司机及其车辆
SELECT 
    d.name as "司机",
    d.phone as "电话",
    d.employment_status as "状态",
    d.base_salary as "基本工资",
    STRING_AGG(
        v.license_plate || 
        CASE WHEN dvr.is_primary THEN ' (主)' ELSE ' (备)' END,
        ', '
    ) as "关联车辆"
FROM internal_drivers d
LEFT JOIN internal_driver_vehicle_relations dvr ON d.id = dvr.driver_id
LEFT JOIN internal_vehicles v ON dvr.vehicle_id = v.id
GROUP BY d.id, d.name, d.phone, d.employment_status, d.base_salary
ORDER BY d.name;

-- 2. 查看所有车辆及其司机
SELECT 
    v.license_plate as "车牌号",
    v.vehicle_type as "车型",
    v.vehicle_brand || ' ' || v.vehicle_model as "品牌型号",
    v.vehicle_status as "状态",
    STRING_AGG(
        d.name || 
        CASE WHEN dvr.is_primary THEN ' (主)' ELSE ' (备)' END,
        ', '
    ) as "关联司机"
FROM internal_vehicles v
LEFT JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
LEFT JOIN internal_drivers d ON dvr.driver_id = d.id
GROUP BY v.id, v.license_plate, v.vehicle_type, v.vehicle_brand, v.vehicle_model, v.vehicle_status
ORDER BY v.license_plate;

-- 3. 查看证件到期提醒
SELECT 
    '司机-' || name as "实体",
    '驾驶证' as "证件类型",
    driver_license_expire_date as "到期日期",
    driver_license_expire_date - CURRENT_DATE as "剩余天数"
FROM internal_drivers
WHERE driver_license_expire_date <= CURRENT_DATE + INTERVAL '180 days'
  AND is_active = true

UNION ALL

SELECT 
    '车辆-' || license_plate as "实体",
    '行驶证' as "证件类型",
    driving_license_expire_date as "到期日期",
    driving_license_expire_date - CURRENT_DATE as "剩余天数"
FROM internal_vehicles
WHERE driving_license_expire_date <= CURRENT_DATE + INTERVAL '180 days'
  AND is_active = true

ORDER BY 3;

