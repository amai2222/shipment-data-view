-- 检查权限表结构
-- 确认实际的表名和字段

-- 1. 检查所有权限相关的表
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%permission%' OR table_name LIKE '%role%'
ORDER BY table_name;

-- 2. 检查 role_permission_templates 表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'role_permission_templates'
ORDER BY ordinal_position;

-- 3. 检查 user_permissions 表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_permissions'
ORDER BY ordinal_position;

-- 4. 检查 profiles 表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. 查看当前角色模板数据
SELECT role, menu_permissions 
FROM role_permission_templates 
WHERE role IN ('admin', 'finance', 'operator');

-- 6. 查看当前用户数据
SELECT id, email, role 
FROM profiles 
WHERE role IN ('admin', 'finance', 'operator')
LIMIT 5;
