-- 同步车队长和司机的菜单权限

-- 1. 查看当前车队长的菜单权限
SELECT 
    role,
    array_length(menu_permissions, 1) as 菜单权限数,
    menu_permissions
FROM role_permission_templates
WHERE role = 'fleet_manager';

-- 2. 更新车队长权限（包含所有 internal 菜单）
UPDATE role_permission_templates
SET menu_permissions = ARRAY[
    -- 数据看板
    'dashboard.transport',
    'dashboard.project',
    
    -- 内部车辆管理（完整列表）
    'internal.fleet_dashboard',
    'internal.vehicles',
    'internal.expense_review',
    'internal.income_input',
    'internal.ledger',
    'internal.pending_tasks',
    'internal.balance',
    'internal.reports',
    'internal.certificates',
    'internal.vehicle_status',
    'internal.expenses',
    
    -- 业务管理
    'business.entry',
    'business.scale',
    
    -- 信息维护
    'maintenance.drivers',
    'maintenance.projects'
],
updated_at = NOW()
WHERE role = 'fleet_manager';

-- 3. 更新司机权限（只包含司机相关菜单）
UPDATE role_permission_templates
SET menu_permissions = ARRAY[
    'internal.my_expenses',
    'internal.quick_entry',
    'internal.driver_salary',
    'internal.salary_records',
    'internal.my_vehicles'
],
updated_at = NOW()
WHERE role = 'driver';

-- 4. 验证更新结果
SELECT 
    role as 角色,
    array_length(menu_permissions, 1) as 菜单权限数,
    menu_permissions as 菜单权限列表
FROM role_permission_templates
WHERE role IN ('fleet_manager', 'driver')
ORDER BY role;

-- 5. 触发同步 admin 权限
SELECT auto_sync_admin_menu_permissions();

