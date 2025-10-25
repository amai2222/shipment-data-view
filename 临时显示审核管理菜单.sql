-- 临时显示审核管理菜单
-- 为所有管理员用户强制添加审核权限

-- 1. 为所有管理员用户添加审核权限
UPDATE user_permissions 
SET 
  menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE role = 'admin'
);

-- 2. 为没有权限记录的管理员用户创建权限记录
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
WHERE p.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM user_permissions up 
  WHERE up.user_id = p.id
);

-- 3. 验证结果
SELECT 
  p.email,
  p.role,
  CASE 
    WHEN 'audit' = ANY(up.menu_permissions) THEN '✅ 审核权限已添加'
    ELSE '❌ 审核权限未添加'
  END as status,
  up.menu_permissions
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role = 'admin'
ORDER BY p.email;
