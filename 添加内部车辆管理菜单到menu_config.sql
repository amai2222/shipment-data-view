-- 添加内部车辆管理菜单到 menu_config 表

-- 车队长菜单
INSERT INTO menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('internal.vehicles', 'internal_management_group', '车辆管理', '/m/internal/vehicles', 'Truck', 1011, false, true, ARRAY['internal.vehicles']),
('internal.expense_review', 'internal_management_group', '费用审核', '/m/internal/expense-review', 'FileText', 1031, false, true, ARRAY['internal.expense_review']),
('internal.fleet_dashboard', 'internal_management_group', '车队工作台', '/m/internal/fleet-dashboard', 'BarChart3', 1001, false, true, ARRAY['internal.vehicles'])
ON CONFLICT (key) DO UPDATE SET
    title = EXCLUDED.title,
    url = EXCLUDED.url,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- 司机菜单
INSERT INTO menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('internal.my_expenses', 'internal_management_group', '我的费用申请', '/m/internal/my-expenses', 'FileText', 1023, false, true, ARRAY['internal.my_expenses']),
('internal.quick_entry', 'internal_management_group', '录入运单', '/m/internal/quick-entry', 'Truck', 1024, false, true, ARRAY['internal.my_expenses']),
('internal.driver_salary', 'internal_management_group', '我的工资', '/m/internal/driver-salary', 'DollarSign', 1021, false, true, ARRAY['internal.driver_salary']),
('internal.my_vehicles', 'internal_management_group', '我的车辆', '/m/internal/my-vehicles', 'Truck', 1025, false, true, ARRAY['internal.my_expenses']),
('internal.salary_records', 'internal_management_group', '工资记录', '/m/internal/salary-records', 'Calendar', 1022, false, true, ARRAY['internal.salary_records'])
ON CONFLICT (key) DO UPDATE SET
    title = EXCLUDED.title,
    url = EXCLUDED.url,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- 手动触发同步admin权限
SELECT auto_sync_admin_menu_permissions();

-- 查看新增的菜单
SELECT key, title, url, is_active 
FROM menu_config 
WHERE key LIKE 'internal.%'
ORDER BY order_index;

