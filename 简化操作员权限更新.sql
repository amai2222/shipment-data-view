-- 简化操作员权限更新脚本
-- 不依赖可能不存在的函数，直接更新权限配置

-- 1. 检查当前操作员角色的权限配置
SELECT 
    '当前操作员角色权限' as check_type,
    role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions
FROM public.role_permission_templates 
WHERE role = 'operator';

-- 2. 更新操作员角色权限模板，添加财务管理权限
UPDATE public.role_permission_templates 
SET 
    menu_permissions = ARRAY[
        -- 数据看板
        'dashboard', 'dashboard.transport', 'dashboard.financial',
        -- 信息维护
        'maintenance', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
        -- 业务管理
        'business', 'business.entry', 'business.scale', 'business.invoice_request', 'business.payment_request',
        -- 财务管理
        'finance', 'finance.reconciliation', 'finance.payment_invoice', 'finance.payment_requests',
        -- 数据维护
        'data_maintenance', 'data_maintenance.waybill',
        -- 合同管理
        'contracts', 'contracts.list'
    ],
    function_permissions = ARRAY[
        -- 数据操作
        'data', 'data.create', 'data.edit', 'data.view', 'data.export',
        -- 磅单管理
        'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
        -- 财务操作
        'finance', 'finance.view_cost', 'finance.generate_invoice', 'finance.reconcile',
        -- 合同管理
        'contract_management', 'contract.view'
    ],
    project_permissions = ARRAY[
        'project_access', 'project.view_assigned', 'project.view_all',
        'project_data', 'project_data.view_operational', 'project_data.view_financial'
    ],
    data_permissions = ARRAY[
        'data_scope', 'data.own', 'data.team', 'data.all',
        'data_operations', 'data.create', 'data.edit', 'data.view', 'data.export'
    ],
    updated_at = now()
WHERE role = 'operator';

-- 3. 为操作员用户添加财务管理权限（如果他们有个人权限配置）
UPDATE public.user_permissions 
SET 
    menu_permissions = ARRAY[
        -- 数据看板
        'dashboard', 'dashboard.transport', 'dashboard.financial',
        -- 信息维护
        'maintenance', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
        -- 业务管理
        'business', 'business.entry', 'business.scale', 'business.invoice_request', 'business.payment_request',
        -- 财务管理
        'finance', 'finance.reconciliation', 'finance.payment_invoice', 'finance.payment_requests',
        -- 数据维护
        'data_maintenance', 'data_maintenance.waybill',
        -- 合同管理
        'contracts', 'contracts.list'
    ],
    function_permissions = ARRAY[
        -- 数据操作
        'data', 'data.create', 'data.edit', 'data.view', 'data.export',
        -- 磅单管理
        'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
        -- 财务操作
        'finance', 'finance.view_cost', 'finance.generate_invoice', 'finance.reconcile',
        -- 合同管理
        'contract_management', 'contract.view'
    ],
    project_permissions = ARRAY[
        'project_access', 'project.view_assigned', 'project.view_all',
        'project_data', 'project_data.view_operational', 'project_data.view_financial'
    ],
    data_permissions = ARRAY[
        'data_scope', 'data.own', 'data.team', 'data.all',
        'data_operations', 'data.create', 'data.edit', 'data.view', 'data.export'
    ],
    updated_at = now()
WHERE user_id IN (
    SELECT id FROM public.profiles WHERE role = 'operator'
) AND project_id IS NULL;

-- 4. 验证更新结果
SELECT 
    '操作员角色权限更新完成' as status,
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates 
WHERE role = 'operator';

-- 5. 检查操作员用户权限
SELECT 
    '操作员用户权限检查' as check_type,
    p.email,
    p.role,
    CASE 
        WHEN up.menu_permissions IS NULL THEN '使用角色默认权限'
        ELSE '使用个人权限配置'
    END as permission_source,
    array_length(up.menu_permissions, 1) as menu_count,
    array_length(up.function_permissions, 1) as function_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE p.role = 'operator';

-- 6. 检查财务管理权限是否包含在菜单权限中
SELECT 
    '财务管理权限检查' as check_type,
    role,
    'finance.reconciliation' = ANY(menu_permissions) as has_finance_reconciliation,
    'finance.payment_invoice' = ANY(menu_permissions) as has_finance_payment_invoice,
    'finance.payment_requests' = ANY(menu_permissions) as has_finance_payment_requests,
    'contracts.list' = ANY(menu_permissions) as has_contracts_list
FROM public.role_permission_templates 
WHERE role = 'operator';

-- 7. 检查财务功能权限
SELECT 
    '财务功能权限检查' as check_type,
    role,
    'finance.view_cost' = ANY(function_permissions) as has_finance_view_cost,
    'finance.generate_invoice' = ANY(function_permissions) as has_finance_generate_invoice,
    'finance.reconcile' = ANY(function_permissions) as has_finance_reconcile,
    'contract.view' = ANY(function_permissions) as has_contract_view
FROM public.role_permission_templates 
WHERE role = 'operator';
