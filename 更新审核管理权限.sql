-- 更新审核管理权限配置
-- 为管理员、财务和操作员角色添加审核管理权限

-- 1. 更新管理员角色权限（如果存在）
UPDATE role_templates 
SET menu_permissions = array_cat(
  COALESCE(menu_permissions, '{}'),
  ARRAY['audit', 'audit.invoice', 'audit.payment']
)
WHERE role = 'admin' 
AND NOT (menu_permissions && ARRAY['audit']);

-- 2. 更新财务角色权限（如果存在）
UPDATE role_templates 
SET menu_permissions = array_cat(
  COALESCE(menu_permissions, '{}'),
  ARRAY['audit', 'audit.invoice', 'audit.payment']
)
WHERE role = 'finance' 
AND NOT (menu_permissions && ARRAY['audit']);

-- 3. 更新操作员角色权限（如果存在）
UPDATE role_templates 
SET menu_permissions = array_cat(
  COALESCE(menu_permissions, '{}'),
  ARRAY['audit', 'audit.invoice', 'audit.payment']
)
WHERE role = 'operator' 
AND NOT (menu_permissions && ARRAY['audit']);

-- 4. 为现有用户更新权限（如果用户有自定义权限）
UPDATE user_permissions 
SET menu_permissions = array_cat(
  COALESCE(menu_permissions, '{}'),
  ARRAY['audit', 'audit.invoice', 'audit.payment']
)
WHERE user_id IN (
  SELECT id FROM users 
  WHERE role IN ('admin', 'finance', 'operator')
)
AND NOT (menu_permissions && ARRAY['audit']);

-- 5. 验证更新结果
SELECT 
  role,
  menu_permissions,
  updated_at
FROM role_templates 
WHERE role IN ('admin', 'finance', 'operator')
ORDER BY role;

-- 6. 检查用户权限
SELECT 
  u.email,
  u.role,
  up.menu_permissions
FROM users u
LEFT JOIN user_permissions up ON u.id = up.user_id
WHERE u.role IN ('admin', 'finance', 'operator')
ORDER BY u.role, u.email;
