-- 验证和修复超级用户权限问题
-- 确保 admin 角色拥有完整的权限配置

-- 1. 检查当前 admin 角色的权限配置
SELECT 
    '当前admin角色权限检查' as category,
    role,
    name,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    CASE 
        WHEN 'project.view_assigned' = ANY(project_permissions) 
        THEN '✅ 包含 project.view_assigned'
        ELSE '❌ 缺少 project.view_assigned'
    END as project_view_assigned_status
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 2. 检查 admin 角色的具体项目权限
SELECT 
    'admin角色项目权限详情' as category,
    unnest(project_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'
ORDER BY permission_key;

-- 3. 更新 admin 角色权限（确保包含所有权限）
UPDATE public.role_permission_templates 
SET 
    menu_permissions = ARRAY[
        'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
        'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
        'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests',
        'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
        'finance', 'finance.reconciliation', 'finance.payment_invoice',
        'data_maintenance', 'data_maintenance.waybill',
        'settings', 'settings.users', 'settings.permissions', 'settings.integrated', 'settings.audit_logs'
    ],
    function_permissions = ARRAY[
        'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
        'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
        'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
        'contract_management', 'contract.view', 'contract.create', 'contract.edit', 'contract.delete', 'contract.archive', 'contract.files_upload', 'contract.files_download', 'contract.files_delete', 'contract.permissions_manage', 'contract.audit_logs', 'contract.reminders', 'contract.tags', 'contract.numbering', 'contract.sensitive_fields', 'contract.export',
        'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
    ],
    project_permissions = ARRAY[
        'project_access', 'project.view_all', 'project.view_assigned', 'project.manage', 'project.admin',
        'project_data', 'project_data.view_financial', 'project_data.edit_financial', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    data_permissions = ARRAY[
        'data_scope', 'data.all', 'data.own', 'data.team', 'data.project',
        'data_operations', 'data.create', 'data.edit', 'data.delete', 'data.export'
    ],
    updated_at = now()
WHERE role = 'admin';

-- 4. 验证更新结果
SELECT 
    '更新后admin角色权限验证' as category,
    role,
    name,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    CASE 
        WHEN 'project.view_assigned' = ANY(project_permissions) 
        THEN '✅ 包含 project.view_assigned'
        ELSE '❌ 缺少 project.view_assigned'
    END as project_view_assigned_status
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 5. 检查所有角色的权限配置
SELECT 
    '所有角色权限配置' as category,
    role,
    name,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates 
ORDER BY role;

-- 6. 说明修复内容
SELECT 
    '修复说明' as category,
    '已修复 admin 角色的权限配置' as description,
    '现在 admin 角色拥有所有权限，包括 project.view_assigned' as result,
    '刷新权限管理页面即可看到正确的权限状态' as instruction;
