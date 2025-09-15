-- 更新数据库中的角色权限模板，添加新的设置页面权限
-- 这个脚本会更新role_permission_templates表中的权限配置

-- 首先查看当前的权限配置
SELECT 
    role,
    name,
    menu_permissions,
    array_length(menu_permissions, 1) as permission_count
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 更新管理员权限，添加新的设置页面权限
UPDATE public.role_permission_templates 
SET menu_permissions = ARRAY[
    -- 数据看板
    'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
    -- 信息维护
    'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
    -- 业务管理
    'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests', 'business.contracts',
    -- 合同管理
    'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
    -- 财务对账
    'finance', 'finance.reconciliation', 'finance.payment_invoice',
    -- 数据维护
    'data_maintenance', 'data_maintenance.waybill',
    -- 设置 - 包含所有新的设置页面权限
    'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
],
updated_at = now()
WHERE role = 'admin';

-- 验证更新结果
SELECT 
    role,
    name,
    menu_permissions,
    array_length(menu_permissions, 1) as permission_count
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 如果上面的更新没有影响任何行，说明role_permission_templates表中没有admin角色的记录
-- 在这种情况下，我们需要插入新记录
INSERT INTO public.role_permission_templates (
    role, 
    name, 
    description, 
    color, 
    menu_permissions, 
    function_permissions, 
    project_permissions, 
    data_permissions, 
    is_system
)
SELECT 
    'admin',
    '系统管理员',
    '拥有系统所有权限，可以管理用户和权限',
    'bg-red-500',
    ARRAY[
        -- 数据看板
        'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
        -- 信息维护
        'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
        -- 业务管理
        'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests', 'business.contracts',
        -- 合同管理
        'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
        -- 财务对账
        'finance', 'finance.reconciliation', 'finance.payment_invoice',
        -- 数据维护
        'data_maintenance', 'data_maintenance.waybill',
        -- 设置 - 包含所有新的设置页面权限
        'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
    ],
    ARRAY[
        'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
        'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
        'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
        'contract_management', 'contract.view', 'contract.create', 'contract.edit', 'contract.delete', 'contract.archive', 'contract.files_upload', 'contract.files_download', 'contract.files_delete', 'contract.permissions_manage', 'contract.audit_logs', 'contract.reminders', 'contract.tags', 'contract.numbering', 'contract.sensitive_fields', 'contract.approve', 'contract.export',
        'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
    ],
    ARRAY[
        'project_access', 'project.view_all', 'project.manage', 'project.admin',
        'project_data', 'project_data.view_financial', 'project_data.edit_financial', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    ARRAY[
        'data_scope', 'data.all', 'data.own', 'data.team', 'data.project',
        'data_operations', 'data.create', 'data.edit', 'data.delete', 'data.export'
    ],
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.role_permission_templates WHERE role = 'admin'
);

-- 最终验证
SELECT 
    role,
    name,
    menu_permissions,
    array_length(menu_permissions, 1) as permission_count
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 显示所有设置相关的权限
SELECT 
    role,
    name,
    array_agg(permission) as settings_permissions
FROM public.role_permission_templates,
     unnest(menu_permissions) as permission
WHERE permission LIKE 'settings%'
GROUP BY role, name
ORDER BY role;
