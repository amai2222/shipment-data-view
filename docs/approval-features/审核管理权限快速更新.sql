-- 审核管理权限快速更新脚本
-- 为管理员、财务和操作员角色添加审核管理权限

-- 1. 检查当前角色模板
SELECT role, menu_permissions FROM role_permission_templates WHERE role IN ('admin', 'finance', 'operator');

-- 2. 更新管理员角色权限
UPDATE role_permission_templates 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE role = 'admin';

-- 3. 更新财务角色权限
UPDATE role_permission_templates 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE role = 'finance';

-- 4. 更新操作员角色权限
UPDATE role_permission_templates 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE role = 'operator';

-- 5. 验证更新结果
SELECT 
  role,
  menu_permissions,
  updated_at
FROM role_permission_templates 
WHERE role IN ('admin', 'finance', 'operator')
ORDER BY role;

-- 6. 检查是否有用户需要更新权限
SELECT 
  p.email,
  p.role,
  up.menu_permissions,
  CASE 
    WHEN up.menu_permissions IS NULL THEN '使用角色模板权限'
    WHEN 'audit' = ANY(up.menu_permissions) THEN '已有审核权限'
    ELSE '需要更新权限'
  END as permission_status
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'operator')
ORDER BY p.role, p.email;
