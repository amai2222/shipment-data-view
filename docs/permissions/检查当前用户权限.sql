-- 检查当前用户权限
-- 查看当前登录用户的权限配置

-- 1. 查看所有用户及其角色
SELECT 
  id,
  email,
  role,
  created_at
FROM profiles 
WHERE role IN ('admin', 'finance', 'operator')
ORDER BY role, email;

-- 2. 查看用户权限记录
SELECT 
  p.email,
  p.role,
  up.menu_permissions,
  up.updated_at
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'operator')
ORDER BY p.role, p.email;

-- 3. 检查是否有审核权限
SELECT 
  p.email,
  p.role,
  CASE 
    WHEN 'audit' = ANY(up.menu_permissions) THEN '✅ 有审核权限'
    WHEN up.menu_permissions IS NULL THEN '❌ 无权限记录'
    ELSE '❌ 无审核权限'
  END as audit_permission_status,
  up.menu_permissions
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'operator')
ORDER BY p.role, p.email;

-- 4. 检查角色模板权限
SELECT 
  role,
  menu_permissions,
  updated_at
FROM role_permission_templates 
WHERE role IN ('admin', 'finance', 'operator')
ORDER BY role;
