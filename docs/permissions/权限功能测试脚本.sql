-- 权限功能测试脚本
-- 用于验证操作员财务管理权限是否正确配置

-- 1. 检查操作员角色权限模板
SELECT 
    '操作员角色权限检查' as test_type,
    role,
    'finance.reconciliation' = ANY(menu_permissions) as has_finance_reconciliation,
    'finance.payment_invoice' = ANY(menu_permissions) as has_finance_payment_invoice,
    'finance.payment_requests' = ANY(menu_permissions) as has_finance_payment_requests,
    'contracts.list' = ANY(menu_permissions) as has_contracts_list,
    'dashboard.financial' = ANY(menu_permissions) as has_dashboard_financial
FROM public.role_permission_templates 
WHERE role = 'operator';

-- 2. 检查操作员财务功能权限
SELECT 
    '操作员财务功能权限检查' as test_type,
    role,
    'finance.view_cost' = ANY(function_permissions) as has_finance_view_cost,
    'finance.generate_invoice' = ANY(function_permissions) as has_finance_generate_invoice,
    'finance.reconcile' = ANY(function_permissions) as has_finance_reconcile,
    'contract.view' = ANY(function_permissions) as has_contract_view
FROM public.role_permission_templates 
WHERE role = 'operator';

-- 3. 检查操作员用户权限（如果有个人配置）
SELECT 
    '操作员用户权限检查' as test_type,
    p.email,
    p.role,
    CASE 
        WHEN up.menu_permissions IS NULL THEN '使用角色默认权限'
        ELSE '使用个人权限配置'
    END as permission_source,
    'finance.reconciliation' = ANY(COALESCE(up.menu_permissions, rpt.menu_permissions)) as has_finance_reconciliation,
    'finance.payment_invoice' = ANY(COALESCE(up.menu_permissions, rpt.menu_permissions)) as has_finance_payment_invoice,
    'contracts.list' = ANY(COALESCE(up.menu_permissions, rpt.menu_permissions)) as has_contracts_list
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON p.role = rpt.role
WHERE p.role = 'operator';

-- 4. 检查权限审计日志表约束
SELECT 
    '权限审计日志约束检查' as test_type,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name 
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_name = 'permission_audit_logs' 
AND tc.table_schema = 'public'
AND tc.constraint_type = 'CHECK'
AND tc.constraint_name LIKE '%action%';

-- 5. 测试权限检查函数（如果存在）
DO $$
BEGIN
    -- 测试权限检查函数是否存在
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_user_menu_permission') THEN
        RAISE NOTICE '权限检查函数存在';
    ELSE
        RAISE NOTICE '权限检查函数不存在，将使用默认权限逻辑';
    END IF;
END $$;

-- 6. 检查所有角色的权限配置
SELECT 
    '所有角色权限统计' as test_type,
    role,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates 
ORDER BY role;

-- 7. 验证操作员权限完整性
SELECT 
    '操作员权限完整性检查' as test_type,
    CASE 
        WHEN 'finance.reconciliation' = ANY(menu_permissions) 
         AND 'finance.payment_invoice' = ANY(menu_permissions)
         AND 'finance.payment_requests' = ANY(menu_permissions)
         AND 'contracts.list' = ANY(menu_permissions)
         AND 'dashboard.financial' = ANY(menu_permissions)
        THEN '✅ 操作员财务管理权限完整'
        ELSE '❌ 操作员财务管理权限不完整'
    END as status
FROM public.role_permission_templates 
WHERE role = 'operator';
