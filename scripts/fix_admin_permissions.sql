-- ============================================================================
-- 修复新建管理员权限问题
-- ============================================================================

-- 步骤1：查找问题账号
-- 请先执行这个查询，找到新建的管理员账号

SELECT 
  id,
  email,
  full_name,
  role,
  created_at,
  '如果role不是admin或finance，这就是问题所在' as note
FROM profiles
WHERE created_at > NOW() - INTERVAL '30 days' -- 最近30天创建的
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================

-- 步骤2：修复角色（如果角色设置错误）
-- ⚠️ 请先确认用户邮箱，然后取消下面的注释并执行

/*
UPDATE profiles 
SET role = 'admin'
WHERE email = '新管理员邮箱@example.com';

-- 验证修改
SELECT 
  email,
  full_name,
  role as "修复后的角色",
  '✅ 已设置为管理员，应该能看到收款人信息了' as status
FROM profiles
WHERE email = '新管理员邮箱@example.com';
*/

-- ============================================================================

-- 步骤3：批量修复多个账号（如果有多个账号需要修复）
-- ⚠️ 请先确认邮箱列表，然后取消注释并执行

/*
UPDATE profiles 
SET role = 'admin'
WHERE email IN (
  '管理员1@example.com',
  '管理员2@example.com',
  '管理员3@example.com'
);

-- 验证批量修改
SELECT 
  email,
  full_name,
  role,
  '✅ 已修复' as status
FROM profiles
WHERE email IN (
  '管理员1@example.com',
  '管理员2@example.com',
  '管理员3@example.com'
);
*/

-- ============================================================================

-- 步骤4：检查修复后的权限
-- 确认所有管理员账号的角色配置正确

SELECT 
  id,
  email,
  full_name,
  role,
  CASE 
    WHEN role = 'admin' THEN '✅ 正确 - 完全权限'
    WHEN role = 'finance' THEN '✅ 正确 - 完全权限'
    ELSE '❌ 错误 - 权限不足'
  END as permission_status,
  created_at
FROM profiles
WHERE email LIKE '%管理%' OR full_name LIKE '%管理%'
   OR role IN ('admin', 'finance')
ORDER BY created_at DESC;

-- ============================================================================

-- 步骤5：验证用户能否访问付款审核功能
-- 检查路由权限配置

SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role IN ('admin', 'finance') THEN '✅ 有权限访问付款审核页面'
    ELSE '❌ 无权限访问付款审核页面'
  END as can_access_payment_audit,
  CASE 
    WHEN p.role IN ('admin', 'finance') THEN '✅ 能看到收款人信息'
    ELSE '❌ 看不到收款人信息'
  END as can_view_payee_info
FROM profiles p
WHERE p.email = '新管理员邮箱@example.com'; -- ⚠️ 替换为实际邮箱

-- ============================================================================

-- 附加：常见问题排查

-- A. 检查是否有重复账号
SELECT 
  email,
  COUNT(*) as account_count,
  STRING_AGG(DISTINCT role, ', ') as roles
FROM profiles
GROUP BY email
HAVING COUNT(*) > 1;

-- B. 检查角色拼写是否正确
SELECT 
  email,
  full_name,
  role,
  CASE 
    WHEN role = 'admin' THEN '✅ 正确'
    WHEN role = 'Admin' THEN '❌ 大小写错误，应该是小写admin'
    WHEN role = 'ADMIN' THEN '❌ 大小写错误，应该是小写admin'
    WHEN role = 'finance' THEN '✅ 正确'
    WHEN role = 'Finance' THEN '❌ 大小写错误，应该是小写finance'
    ELSE '⚠️ 非标准角色'
  END as role_check
FROM profiles
WHERE role ILIKE '%admin%' OR role ILIKE '%finance%';

-- C. 检查是否有NULL或空值
SELECT 
  id,
  email,
  full_name,
  role,
  CASE 
    WHEN role IS NULL THEN '❌ role为NULL'
    WHEN role = '' THEN '❌ role为空字符串'
    WHEN role NOT IN ('admin', 'finance', 'business', 'operator', 'viewer') THEN '❌ 角色值不在预定义列表中'
    ELSE '✅ 角色正确'
  END as role_validation
FROM profiles
ORDER BY created_at DESC
LIMIT 20;

