-- Supabase 超级管理员权限快速修复脚本
-- 修复超级管理员权限显示为空的问题

-- 1. 检查当前问题
SELECT 
    '=== 超级管理员权限快速修复 ===' as section,
    '修复时间: ' || now() as fix_time;

-- 2. 确保当前用户角色是admin
UPDATE public.profiles 
SET role = 'admin'::app_role
WHERE id = auth.uid() 
AND role != 'admin';

-- 3. 清理当前用户的特定权限（让用户使用角色模板权限）
DELETE FROM public.user_permissions 
WHERE user_id = auth.uid() 
AND project_id IS NULL;

-- 4. 确保admin角色权限模板存在且完整
INSERT INTO public.role_permission_templates (
    role, name, menu_permissions, function_permissions, 
    project_permissions, data_permissions, created_at, updated_at
) VALUES (
    'admin', '超级管理员',
    ARRAY[
        'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
        'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
        'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests',
        'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files', 'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
        'finance', 'finance.reconciliation', 'finance.payment_invoice',
        'data_maintenance', 'data_maintenance.waybill',
        'settings', 'settings.users', 'settings.permissions', 'settings.integrated', 'settings.audit_logs'
    ],
    ARRAY[
        'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
        'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
        'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
        'contract_management', 'contract.view', 'contract.create', 'contract.edit', 'contract.delete', 'contract.archive', 'contract.files_upload', 'contract.files_download', 'contract.files_delete', 'contract.permissions_manage', 'contract.audit_logs', 'contract.reminders', 'contract.tags', 'contract.numbering', 'contract.sensitive_fields', 'contract.export',
        'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
    ],
    ARRAY[
        'project_access', 'project.view_all', 'project.view_assigned', 'project.manage', 'project.admin',
        'project_data', 'project_data.view_financial', 'project_data.edit_financial', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    ARRAY[
        'data_scope', 'data.all', 'data.own', 'data.team', 'data.project',
        'data_operations', 'data.create', 'data.edit', 'data.delete', 'data.export'
    ],
    now(), now()
) ON CONFLICT (role) DO UPDATE SET
    menu_permissions = EXCLUDED.menu_permissions,
    function_permissions = EXCLUDED.function_permissions,
    project_permissions = EXCLUDED.project_permissions,
    data_permissions = EXCLUDED.data_permissions,
    updated_at = now();

-- 5. 重新创建权限检查函数
CREATE OR REPLACE FUNCTION check_permission_inheritance()
RETURNS TABLE(
    user_id uuid,
    user_email text,
    user_role text,
    permission_type text,
    permission_source text,
    menu_count integer,
    function_count integer,
    project_count integer,
    data_count integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.role::text as user_role,
        CASE 
            WHEN up.user_id IS NULL THEN 'role_template'
            WHEN up.inherit_role = true THEN 'inherited'
            ELSE 'custom'
        END as permission_type,
        CASE 
            WHEN up.user_id IS NULL THEN rpt.name
            ELSE '用户特定权限'
        END as permission_source,
        COALESCE(array_length(COALESCE(up.menu_permissions, rpt.menu_permissions), 1), 0) as menu_count,
        COALESCE(array_length(COALESCE(up.function_permissions, rpt.function_permissions), 1), 0) as function_count,
        COALESCE(array_length(COALESCE(up.project_permissions, rpt.project_permissions), 1), 0) as project_count,
        COALESCE(array_length(COALESCE(up.data_permissions, rpt.data_permissions), 1), 0) as data_count
    FROM public.profiles p
    LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
    LEFT JOIN public.role_permission_templates rpt ON rpt.role::text = p.role::text
    ORDER BY p.role::text, p.email;
END;
$$ LANGUAGE plpgsql;

-- 6. 重新创建权限检查视图
DROP VIEW IF EXISTS user_permission_status CASCADE;

CREATE VIEW user_permission_status AS
SELECT 
    p.id,
    p.email,
    p.role::text as role,
    p.is_active,
    CASE 
        WHEN up.user_id IS NULL THEN 'role_template'
        WHEN up.inherit_role = true THEN 'inherited'
        ELSE 'custom'
    END as permission_type,
    CASE 
        WHEN up.user_id IS NULL THEN rpt.name
        ELSE '用户特定权限'
    END as permission_source,
    COALESCE(up.menu_permissions, rpt.menu_permissions) as effective_menu_permissions,
    COALESCE(up.function_permissions, rpt.function_permissions) as effective_function_permissions,
    COALESCE(up.project_permissions, rpt.project_permissions) as effective_project_permissions,
    COALESCE(up.data_permissions, rpt.data_permissions) as effective_data_permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON rpt.role::text = p.role::text;

-- 7. 验证修复结果
SELECT 
    '=== 修复结果验证 ===' as section;

-- 检查当前用户权限状态
SELECT 
    '当前用户权限状态' as category,
    p.email,
    p.role::text as role,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板权限'
        WHEN up.inherit_role = true THEN '继承角色权限'
        ELSE '用户特定权限'
    END as permission_source,
    COALESCE(array_length(up.menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(up.function_permissions, 1), 0) as function_count,
    COALESCE(array_length(up.project_permissions, 1), 0) as project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as data_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE p.id = auth.uid();

-- 8. 检查权限检查函数结果
SELECT 
    '权限检查函数结果' as category;

SELECT * FROM check_permission_inheritance() 
WHERE user_id = auth.uid();

-- 9. 检查权限检查视图结果
SELECT 
    '权限检查视图结果' as category;

SELECT 
    id,
    email,
    role,
    permission_type,
    permission_source,
    array_length(effective_menu_permissions, 1) as menu_count,
    array_length(effective_function_permissions, 1) as function_count,
    array_length(effective_project_permissions, 1) as project_count,
    array_length(effective_data_permissions, 1) as data_count
FROM user_permission_status 
WHERE id = auth.uid();

-- 10. 检查admin角色权限详情
SELECT 
    'Admin角色权限详情' as category,
    '项目权限' as permission_type,
    unnest(project_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'

UNION ALL

SELECT 
    'Admin角色权限详情' as category,
    '数据权限' as permission_type,
    unnest(data_permissions) as permission_key
FROM public.role_permission_templates 
WHERE role = 'admin'

ORDER BY permission_type, permission_key;

-- 11. 最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    '超级管理员权限修复完成' as status,
    '用户角色已设置为admin' as role_fix,
    '用户特定权限已清理' as permission_cleanup,
    '角色权限模板已更新' as template_update,
    '权限检查函数已重建' as function_rebuild,
    '请刷新权限管理页面查看效果' as instruction;
