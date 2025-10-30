-- 直接更新用户审核权限
-- 为所有管理员、财务和操作员用户添加审核管理权限

-- 1. 更新管理员用户的权限
UPDATE user_permissions 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE role = 'admin'
);

-- 2. 更新财务用户的权限
UPDATE user_permissions 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE role = 'finance'
);

-- 3. 更新操作员用户的权限
UPDATE user_permissions 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE role = 'operator'
);

-- 4. 为没有权限记录的用户创建权限记录
INSERT INTO user_permissions (user_id, menu_permissions, function_permissions, project_permissions, data_permissions, created_at, updated_at)
SELECT 
  p.id,
  ARRAY['audit', 'audit.invoice', 'audit.payment'],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  NOW(),
  NOW()
FROM profiles p
WHERE p.role IN ('admin', 'finance', 'operator')
AND NOT EXISTS (
  SELECT 1 FROM user_permissions up 
  WHERE up.user_id = p.id
);

-- 5. 验证更新结果
SELECT 
  p.email,
  p.role,
  up.menu_permissions,
  CASE 
    WHEN 'audit' = ANY(up.menu_permissions) THEN '✅ 已有审核权限'
    ELSE '❌ 缺少审核权限'
  END as permission_status
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'operator')
ORDER BY p.role, p.email;

-- 6. 统计更新结果
SELECT 
  p.role,
  COUNT(*) as total_users,
  COUNT(CASE WHEN 'audit' = ANY(up.menu_permissions) THEN 1 END) as users_with_audit_permission
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'operator')
GROUP BY p.role
ORDER BY p.role;
