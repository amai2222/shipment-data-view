-- 更新操作员财务管理权限
-- 确保操作员用户能够看到财务管理菜单和相关权限

-- 1. 更新操作员角色权限模板，添加财务管理权限
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

-- 2. 为操作员用户添加财务管理权限（如果他们有个人权限配置）
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

-- 3. 创建操作员权限验证函数
CREATE OR REPLACE FUNCTION public.validate_operator_permissions()
RETURNS TABLE(
    user_email text,
    has_finance_menu boolean,
    has_finance_functions boolean,
    has_contract_access boolean,
    missing_permissions text[]
) AS $$
DECLARE
    user_record RECORD;
    missing_perms text[] := '{}';
BEGIN
    FOR user_record IN 
        SELECT p.id, p.email, p.role
        FROM public.profiles p
        WHERE p.role = 'operator'
    LOOP
        missing_perms := '{}';
        
        -- 检查财务管理菜单权限
        IF NOT public.check_user_menu_permission(user_record.id, 'finance.reconciliation') THEN
            missing_perms := array_append(missing_perms, 'finance.reconciliation');
        END IF;
        
        IF NOT public.check_user_menu_permission(user_record.id, 'finance.payment_invoice') THEN
            missing_perms := array_append(missing_perms, 'finance.payment_invoice');
        END IF;
        
        IF NOT public.check_user_menu_permission(user_record.id, 'finance.payment_requests') THEN
            missing_perms := array_append(missing_perms, 'finance.payment_requests');
        END IF;
        
        -- 检查合同管理权限
        IF NOT public.check_user_menu_permission(user_record.id, 'contracts.list') THEN
            missing_perms := array_append(missing_perms, 'contracts.list');
        END IF;
        
        RETURN QUERY SELECT 
            user_record.email,
            (array_length(missing_perms, 1) = 0 OR 'finance.reconciliation' = ANY(missing_perms) = false),
            public.check_user_menu_permission(user_record.id, 'finance.view_cost'),
            public.check_user_menu_permission(user_record.id, 'contracts.list'),
            missing_perms;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 添加注释说明
COMMENT ON FUNCTION public.validate_operator_permissions IS '验证操作员用户是否具有完整的财务管理权限';

-- 5. 验证更新结果
SELECT 
    '操作员角色权限更新完成' as status,
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates 
WHERE role = 'operator';
