-- 批量添加审核权限
-- 为所有相关用户添加审核管理权限

-- 1. 更新现有用户权限记录
UPDATE user_permissions 
SET 
  menu_permissions = array_cat(menu_permissions, ARRAY['audit', 'audit.invoice', 'audit.payment']),
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE role IN ('admin', 'finance', 'operator')
)
AND NOT ('audit' = ANY(menu_permissions));

-- 2. 为没有权限记录的用户创建权限记录
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

-- 3. 显示更新结果
SELECT 
  p.email,
  p.role,
  CASE 
    WHEN 'audit' = ANY(up.menu_permissions) THEN '✅ 审核权限已添加'
    ELSE '❌ 审核权限未添加'
  END as status
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'operator')
ORDER BY p.role, p.email;
