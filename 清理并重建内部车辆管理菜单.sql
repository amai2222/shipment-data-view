-- ============================================================================
-- 清理并重建内部车辆管理菜单
-- 创建日期：2025-11-06
-- ============================================================================

-- ============================================================================
-- 第一步：删除所有内部车辆管理相关的旧菜单
-- ============================================================================

DELETE FROM menu_config
WHERE title LIKE '%内部车辆%' 
   OR title LIKE '%内部司机%'
   OR url LIKE '%/internal/%'
   OR parent_key IN (
       SELECT key FROM menu_config WHERE title = '内部车辆管理'
   );

-- ============================================================================
-- 第二步：重新创建干净的菜单结构
-- ============================================================================

-- 1. 创建内部车辆管理分组（PC端）
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    is_active,
    is_group,
    description
) VALUES (
    'internal_vehicle_management',
    '内部车辆管理',
    '/internal',
    'Truck',
    500,
    true,
    true,  -- 分组菜单
    '管理公司自有车辆和司机'
);

-- 2. PC端子菜单

-- 2.1 车辆档案管理
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_vehicles',
    'internal_vehicle_management',
    '车辆档案管理',
    '/internal/vehicles',
    'Truck',
    501,
    ARRAY['internal.manage_vehicles'],
    true,
    false  -- 不是分组
);

-- 2.2 内部司机管理
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_drivers',
    'internal_vehicle_management',
    '内部司机管理',
    '/internal/drivers',
    'Users',
    502,
    ARRAY['internal.manage_drivers'],
    true,
    false
);

-- 2.3 费用申请审核
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_expense_approval',
    'internal_vehicle_management',
    '费用申请审核',
    '/internal/expense-approval',
    'FileText',
    503,
    ARRAY['internal.approve_expenses'],
    true,
    false
);

-- 2.4 证件管理
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_certificates',
    'internal_vehicle_management',
    '证件管理',
    '/internal/certificates',
    'FileText',
    504,
    ARRAY['internal.manage_certificates'],
    true,
    false
);

-- 2.5 车辆状态
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_vehicle_status',
    'internal_vehicle_management',
    '车辆状态',
    '/internal/vehicle-status',
    'Activity',
    505,
    ARRAY['internal.view_vehicles'],
    true,
    false
);

-- 2.6 车辆收支流水
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_ledger',
    'internal_vehicle_management',
    '车辆收支流水',
    '/internal/ledger',
    'BookOpen',
    506,
    ARRAY['internal.view_finance'],
    true,
    false
);

-- 2.7 费用分类统计
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_expenses',
    'internal_vehicle_management',
    '费用分类统计',
    '/internal/expenses',
    'Tags',
    507,
    ARRAY['internal.view_finance'],
    true,
    false
);

-- 2.8 车辆余额
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_balance',
    'internal_vehicle_management',
    '车辆余额',
    '/internal/balance',
    'Coins',
    508,
    ARRAY['internal.view_finance'],
    true,
    false
);

-- 2.9 财务报表
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_reports',
    'internal_vehicle_management',
    '财务报表',
    '/internal/reports',
    'BarChart',
    509,
    ARRAY['internal.view_finance'],
    true,
    false
);

-- 2.10 月度收入录入
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_income_input',
    'internal_vehicle_management',
    '月度收入录入',
    '/internal/income-input',
    'PlusCircle',
    510,
    ARRAY['internal.manage_finance'],
    true,
    false
);

-- 2.11 待办事项
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_pending_tasks',
    'internal_vehicle_management',
    '待办事项',
    '/internal/pending-tasks',
    'Bell',
    511,
    ARRAY['internal.view_vehicles'],
    true,
    false
);

-- ============================================================================
-- 第2.5步：添加新功能菜单（PC端）
-- ============================================================================

-- 2.12 车辆分配管理
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_vehicle_assignment',
    'internal_vehicle_management',
    '车辆分配管理',
    '/internal/vehicle-assignment',
    'Link',
    512,
    ARRAY['internal.manage_vehicles'],
    true,
    false
);

-- 2.13 任务派单
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_task_dispatch',
    'internal_vehicle_management',
    '任务派单',
    '/internal/task-dispatch',
    'Send',
    513,
    ARRAY['internal.fleet_manager'],
    true,
    false
);

-- 2.14 每日运单
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_daily_waybills',
    'internal_vehicle_management',
    '每日运单',
    '/internal/daily-waybills',
    'Calendar',
    514,
    ARRAY['internal.view_vehicles'],
    true,
    false
);

-- 2.15 车队配置
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_fleet_config',
    'internal_vehicle_management',
    '车队配置',
    '/internal/fleet-config',
    'Settings',
    515,
    ARRAY['internal.fleet_manager'],
    true,
    false
);

-- 2.16 司机账号关联（从设置移到这里）
INSERT INTO menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group
) VALUES (
    'internal_driver_association',
    'internal_vehicle_management',
    '司机账号关联',
    '/internal/driver-association',
    'UserPlus',
    516,
    ARRAY['internal.manage_drivers'],
    true,
    false
);

-- ============================================================================
-- 第三步：添加移动端菜单（独立顶级菜单，由前端根据角色动态显示）
-- ============================================================================
-- 注：移动端菜单不放在分组下，作为顶级菜单，前端会根据用户角色过滤

-- 司机移动端菜单（独立顶级）
-- 3.1 我的车辆
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_my_vehicles',
    '我的车辆',
    '/m/internal/my-vehicles',
    'Truck',
    1001,
    ARRAY['internal.driver'],
    true,
    false,
    '司机移动端-查看我的车辆'
);

-- 3.2 我的工资
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_driver_salary',
    '我的工资',
    '/m/internal/driver-salary',
    'DollarSign',
    1002,
    ARRAY['internal.driver'],
    true,
    false,
    '司机移动端-工资查询'
);

-- 3.3 工资记录
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_salary_records',
    '工资记录',
    '/m/internal/salary-records',
    'Calendar',
    1003,
    ARRAY['internal.driver'],
    true,
    false,
    '司机移动端-历史工资记录'
);

-- 3.4 我的费用申请
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_my_expenses',
    '我的费用申请',
    '/m/internal/my-expenses',
    'FileText',
    1004,
    ARRAY['internal.driver'],
    true,
    false,
    '司机移动端-费用申请'
);

-- 车队长移动端菜单（独立顶级）
-- 3.5 车队工作台
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_fleet_dashboard',
    '车队工作台',
    '/m/internal/fleet-dashboard',
    'BarChart3',
    2001,
    ARRAY['internal.fleet_manager'],
    true,
    false,
    '车队长移动端工作台'
);

-- 3.6 车辆管理（车队长）
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_fleet_vehicles',
    '车辆管理',
    '/m/internal/vehicles',
    'Truck',
    2002,
    ARRAY['internal.fleet_manager'],
    true,
    false,
    '车队长移动端-车辆管理'
);

-- 3.7 费用审核（车队长）
INSERT INTO menu_config (
    key,
    title,
    url,
    icon,
    order_index,
    required_permissions,
    is_active,
    is_group,
    description
) VALUES (
    'mobile_fleet_expense_approval',
    '费用审核',
    '/m/internal/expense-review',
    'FileText',
    2003,
    ARRAY['internal.fleet_manager'],
    true,
    false,
    '车队长移动端-费用审核'
);

-- ============================================================================
-- 验证结果
-- ============================================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM menu_config
    WHERE parent_key = 'internal_vehicle_management';
    
    DECLARE
        v_pc_count INTEGER;
        v_mobile_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_pc_count
        FROM menu_config
        WHERE parent_key = 'internal_vehicle_management';
        
        SELECT COUNT(*) INTO v_mobile_count
        FROM menu_config
        WHERE parent_key IS NULL
        AND url LIKE '/m/internal/%';
        
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ 菜单重建完成';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE '菜单统计：';
        RAISE NOTICE '  • PC端（只在PC浏览器显示）：';
        RAISE NOTICE '    - 内部车辆管理分组：1个';
        RAISE NOTICE '    - PC端子菜单：16个（包含新增的5个功能）';
        RAISE NOTICE '';
        RAISE NOTICE '';
        RAISE NOTICE '  • 移动端（独立顶级菜单，只在移动设备显示）：';
        RAISE NOTICE '    - 司机菜单：4个（我的车辆、我的工资、工资记录、我的费用申请）';
        RAISE NOTICE '    - 车队长菜单：3个（车队工作台、车辆管理、费用审核）';
        RAISE NOTICE '';
        RAISE NOTICE '显示规则：';
        RAISE NOTICE '  ✓ PC端用户：只看到PC端菜单（501-516）';
        RAISE NOTICE '  ✓ 移动端-司机：只看到司机菜单（1001-1004）';
        RAISE NOTICE '  ✓ 移动端-车队长：只看到车队长菜单（2001-2003）';
        RAISE NOTICE '  ✓ 前端根据设备类型和用户角色自动过滤';
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
    END;
END $$;

-- 查看最终菜单结构
SELECT 
    CASE 
        WHEN parent_key IS NULL THEN title
        ELSE '  └─ ' || title
    END as 菜单结构,
    url as 路径,
    icon as 图标,
    order_index as 顺序,
    is_group as 是否分组
FROM menu_config
WHERE key = 'internal_vehicle_management'
   OR parent_key = 'internal_vehicle_management'
ORDER BY order_index;

