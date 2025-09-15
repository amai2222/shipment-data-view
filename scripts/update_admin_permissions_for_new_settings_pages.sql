-- 更新管理员权限，添加新的设置页面权限
-- 这个脚本会为管理员角色添加新的权限

-- 首先检查当前的权限配置
SELECT 
    r.name as role_name,
    rp.menu_permissions,
    rp.function_permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.name = 'admin';

-- 更新管理员权限，添加新的设置页面权限
UPDATE role_permissions 
SET menu_permissions = ARRAY[
    'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project',
    'info', 'info.projects', 'info.drivers', 'info.locations', 'info.partners',
    'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests',
    'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
    'finance', 'finance.reconciliation', 'finance.payment_invoice',
    'data_maintenance', 'data_maintenance.waybill',
    'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
]
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin');

-- 验证更新结果
SELECT 
    r.name as role_name,
    rp.menu_permissions,
    array_length(rp.menu_permissions, 1) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.name = 'admin';

-- 如果上面的更新没有影响任何行，说明role_permissions表中没有admin角色的记录
-- 在这种情况下，我们需要插入新记录
INSERT INTO role_permissions (role_id, menu_permissions, function_permissions)
SELECT 
    r.id,
    ARRAY[
        'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project',
        'info', 'info.projects', 'info.drivers', 'info.locations', 'info.partners',
        'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests',
        'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
        'finance', 'finance.reconciliation', 'finance.payment_invoice',
        'data_maintenance', 'data_maintenance.waybill',
        'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
    ],
    ARRAY[
        'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
        'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
        'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
        'contracts', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
        'users', 'users.create', 'users.edit', 'users.delete', 'users.view',
        'roles', 'roles.create', 'roles.edit', 'roles.delete', 'roles.view',
        'permissions', 'permissions.assign', 'permissions.revoke', 'permissions.view'
    ]
FROM roles r
WHERE r.name = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id
);

-- 最终验证
SELECT 
    r.name as role_name,
    rp.menu_permissions,
    array_length(rp.menu_permissions, 1) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.name = 'admin';
