-- 修复权限审计日志表的约束问题
-- 创建时间: 2025-01-28

-- 删除旧的约束
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_action_check;

-- 添加新的约束，包含所有必要的action值
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_action_check 
CHECK (action IN (
    'grant', 'revoke', 'modify', 'inherit', 
    'create', 'update', 'delete', 
    'activate', 'deactivate',
    'role_changed', 'user_info', 'user_role', 
    'user_status', 'user_permission'
));

-- 删除旧的permission_type约束
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_permission_type_check;

-- 添加新的permission_type约束，包含所有必要的类型
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_permission_type_check 
CHECK (permission_type IN (
    'menu', 'function', 'project', 'data', 
    'role', 'user', 'template'
));

-- 验证约束是否正确应用
SELECT 
    '约束修复完成' as status,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'permission_audit_logs' 
AND table_schema = 'public';
