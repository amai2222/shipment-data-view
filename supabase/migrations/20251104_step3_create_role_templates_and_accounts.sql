-- ============================================================================
-- 步骤3：创建车队长和司机的角色模板及测试账号
-- ============================================================================
-- 功能：为新角色创建权限模板，并创建测试登录账号
-- 前置条件：已执行 step1（添加角色）和 step2（创建表）
-- 创建时间：2025-11-04
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：创建角色权限模板
-- ==========================================

-- 1. 车队长角色模板
INSERT INTO role_permission_templates (
    role,
    name,
    description,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions
) VALUES (
    'fleet_manager',
    '车队长',
    '管理内部车辆和司机，审核费用申请',
    ARRAY[
        -- 数据看板
        'dashboard.transport',
        'dashboard.project',
        
        -- 内部车辆管理（核心权限）
        'internal.vehicles',
        'internal.certificates',
        'internal.vehicle_status',
        'internal.expense_review',
        'internal.income_input',
        'internal.pending_tasks',
        'internal.ledger',
        'internal.balance',
        'internal.reports',
        
        -- 业务管理
        'business.entry',
        'business.scale',
        
        -- 信息维护
        'maintenance.drivers',
        'maintenance.projects'
    ],
    ARRAY[
        'data.create',
        'data.edit',
        'data.export',
        'scale_records.create',
        'scale_records.edit',
        'scale_records.view',
        'internal.approve_expense',
        'internal.input_income'
    ],
    ARRAY['all'],
    ARRAY['all']
) ON CONFLICT (role) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    menu_permissions = EXCLUDED.menu_permissions,
    function_permissions = EXCLUDED.function_permissions,
    project_permissions = EXCLUDED.project_permissions,
    data_permissions = EXCLUDED.data_permissions,
    updated_at = NOW();

-- 2. 司机角色模板
INSERT INTO role_permission_templates (
    role,
    name,
    description,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions
) VALUES (
    'driver',
    '司机',
    '内部司机，可查看工资和提交费用申请',
    ARRAY[
        -- 只能访问内部司机相关页面
        'internal.my_expenses',      -- 我的费用申请
        'internal.driver_salary',    -- 我的工资
        'internal.salary_records'    -- 工资记录
    ],
    ARRAY[
        'data.create',              -- 可以创建运单
        'internal.submit_expense'   -- 可以提交费用申请
    ],
    ARRAY[]::TEXT[],  -- 无项目权限
    ARRAY[]::TEXT[]   -- 无数据权限
) ON CONFLICT (role) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    menu_permissions = EXCLUDED.menu_permissions,
    function_permissions = EXCLUDED.function_permissions,
    project_permissions = EXCLUDED.project_permissions,
    data_permissions = EXCLUDED.data_permissions,
    updated_at = NOW();

-- ==========================================
-- 第二步：测试账号创建说明
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️ 如何创建测试账号';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '方法1：在系统后台创建（推荐）';
    RAISE NOTICE '  1. 登录系统后台';
    RAISE NOTICE '  2. 打开：系统设置 → 用户管理';
    RAISE NOTICE '  3. 点击"新建用户"';
    RAISE NOTICE '  4. 填写信息：';
    RAISE NOTICE '     - 邮箱：fleet_manager@test.com';
    RAISE NOTICE '     - 密码：FleetManager123!';
    RAISE NOTICE '     - 姓名：车队长-张伟';
    RAISE NOTICE '     - 角色：车队长 ⭐';
    RAISE NOTICE '  5. 点击"创建用户"';
    RAISE NOTICE '  6. 重复步骤创建司机账号：';
    RAISE NOTICE '     - 邮箱：driver@test.com';
    RAISE NOTICE '     - 密码：Driver123!';
    RAISE NOTICE '     - 姓名：司机-王师傅';
    RAISE NOTICE '     - 角色：司机 ⭐';
    RAISE NOTICE '';
    RAISE NOTICE '方法2：在 Supabase Dashboard 创建';
    RAISE NOTICE '  1. 打开 Supabase Dashboard → Authentication → Users';
    RAISE NOTICE '  2. 点击 "Add user" → "Create new user"';
    RAISE NOTICE '  3. 填写邮箱和密码';
    RAISE NOTICE '  4. Auto Confirm User: 勾选';
    RAISE NOTICE '  5. 创建后，在 profiles 表更新角色：';
    RAISE NOTICE '     UPDATE profiles SET role = ''fleet_manager'' WHERE email = ''fleet_manager@test.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 第三步：验证角色模板创建
-- ==========================================

DO $$
DECLARE
    v_fleet_manager_permissions INTEGER;
    v_driver_permissions INTEGER;
    v_total_roles INTEGER;
BEGIN
    -- 统计权限数量
    SELECT array_length(menu_permissions, 1) INTO v_fleet_manager_permissions
    FROM role_permission_templates
    WHERE role = 'fleet_manager';
    
    SELECT array_length(menu_permissions, 1) INTO v_driver_permissions
    FROM role_permission_templates
    WHERE role = 'driver';
    
    -- 统计总角色数
    SELECT COUNT(*) INTO v_total_roles
    FROM role_permission_templates;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 角色模板创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '角色模板统计：';
    RAISE NOTICE '  - 总角色数: %', v_total_roles;
    RAISE NOTICE '  - 车队长菜单权限: %', v_fleet_manager_permissions;
    RAISE NOTICE '  - 司机菜单权限: %', v_driver_permissions;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 查看所有角色模板
-- ==========================================

SELECT 
    role as "角色",
    name as "角色名称",
    description as "描述",
    array_length(menu_permissions, 1) as "菜单权限数",
    array_length(function_permissions, 1) as "功能权限数"
FROM role_permission_templates
ORDER BY role;

