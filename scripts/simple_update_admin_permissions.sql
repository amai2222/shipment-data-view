-- 简化版数据库权限更新脚本
-- 直接更新role_permission_templates表中的admin权限

-- 更新管理员权限，添加新的设置页面权限
UPDATE public.role_permission_templates 
SET menu_permissions = ARRAY[
    'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
    'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
    'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests', 'business.contracts',
    'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
    'finance', 'finance.reconciliation', 'finance.payment_invoice',
    'data_maintenance', 'data_maintenance.waybill',
    'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
],
updated_at = now()
WHERE role = 'admin';

-- 验证更新结果
SELECT 
    role,
    name,
    array_length(menu_permissions, 1) as permission_count,
    array_agg(permission) as settings_permissions
FROM public.role_permission_templates,
     unnest(menu_permissions) as permission
WHERE role = 'admin' AND permission LIKE 'settings%'
GROUP BY role, name, permission_count;
