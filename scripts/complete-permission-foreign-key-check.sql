-- 完整权限表外键关系检查
-- 检查所有权限相关表的外键约束

-- 1. 检查 user_projects 表的外键约束
SELECT 
    'user_projects外键检查' as category,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'user_projects'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_name;

-- 2. 检查所有权限表的完整外键关系
SELECT 
    '完整权限表外键关系' as category,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name,
    CASE 
        WHEN tc.table_name = 'user_permissions' THEN '用户权限表'
        WHEN tc.table_name = 'role_permission_templates' THEN '角色权限模板表'
        WHEN tc.table_name = 'permission_audit_logs' THEN '权限审计日志表'
        WHEN tc.table_name = 'user_projects' THEN '用户项目关联表'
        WHEN tc.table_name = 'contract_permissions' THEN '合同权限表'
        WHEN tc.table_name = 'contract_access_logs' THEN '合同访问日志表'
        ELSE '其他表'
    END as table_description
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'contract_permissions',
    'contract_access_logs'
  )
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 3. 检查外键约束的删除行为
SELECT 
    '外键删除行为检查' as category,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name,
    CASE 
        WHEN tc.constraint_name LIKE '%_fkey' THEN '标准外键约束'
        ELSE '其他约束'
    END as constraint_type
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'contract_permissions',
    'contract_access_logs'
  )
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 4. 检查权限表的数据完整性统计
SELECT 
    '权限表数据统计' as category,
    'user_permissions' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT project_id) as unique_projects,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as records_with_creator
FROM public.user_permissions
UNION ALL
SELECT 
    '权限表数据统计' as category,
    'permission_audit_logs' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT target_project_id) as unique_projects,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as records_with_creator
FROM public.permission_audit_logs;

-- 5. 检查权限表的主键约束
SELECT 
    '权限表主键检查' as category,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    CASE 
        WHEN tc.table_name = 'user_permissions' THEN '用户权限表主键'
        WHEN tc.table_name = 'role_permission_templates' THEN '角色权限模板表主键'
        WHEN tc.table_name = 'permission_audit_logs' THEN '权限审计日志表主键'
        WHEN tc.table_name = 'user_projects' THEN '用户项目关联表主键'
        WHEN tc.table_name = 'contract_permissions' THEN '合同权限表主键'
        WHEN tc.table_name = 'contract_access_logs' THEN '合同访问日志表主键'
        ELSE '其他表主键'
    END as description
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' 
  AND tc.table_name IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'contract_permissions',
    'contract_access_logs'
  )
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 6. 检查权限表的唯一约束
SELECT 
    '权限表唯一约束检查' as category,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    CASE 
        WHEN tc.constraint_name LIKE '%_user_id_project_id_key' THEN '用户项目唯一约束'
        WHEN tc.constraint_name LIKE '%_role_key' THEN '角色唯一约束'
        ELSE '其他唯一约束'
    END as description
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
  AND tc.table_name IN (
    'user_permissions', 
    'role_permission_templates', 
    'permission_audit_logs', 
    'contract_permissions',
    'contract_access_logs'
  )
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;
