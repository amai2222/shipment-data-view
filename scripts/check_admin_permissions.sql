-- ============================================================================
-- 检查管理员账号权限配置
-- 用于排查新建管理员为什么没有权限的问题
-- ============================================================================

-- 1️⃣ 查询所有管理员用户的基本信息
-- 这会显示所有role为'admin'的用户
SELECT 
  id,
  email,
  full_name,
  role,
  created_at,
  work_wechat_userid,
  CASE 
    WHEN role = 'admin' THEN '✅ 管理员'
    WHEN role = 'finance' THEN '💰 财务'
    WHEN role = 'business' THEN '📋 业务'
    WHEN role = 'operator' THEN '👤 操作员'
    WHEN role = 'viewer' THEN '👁️ 查看者'
    ELSE '❓ 其他'
  END as role_display
FROM profiles
WHERE role IN ('admin', 'finance')
ORDER BY created_at DESC;

-- ============================================================================

-- 2️⃣ 查询特定用户的详细信息（请替换邮箱或ID）
-- 方法A：按邮箱查询
-- SELECT * FROM profiles WHERE email = '新管理员的邮箱@example.com';

-- 方法B：按姓名模糊查询
-- SELECT * FROM profiles WHERE full_name LIKE '%管理员姓名%';

-- 方法C：按ID查询
-- SELECT * FROM profiles WHERE id = '用户UUID';

-- ============================================================================

-- 3️⃣ 对比两个管理员账号的配置差异
-- 请替换为实际的用户ID或邮箱

-- 查看第一个管理员（能看到收款人信息）
SELECT 
  'admin_1' as account_type,
  id,
  email,
  full_name,
  role,
  work_wechat_userid,
  created_at
FROM profiles 
WHERE email = '第一个管理员邮箱@example.com' -- ⚠️ 替换为实际邮箱
UNION ALL
-- 查看第二个管理员（看不到收款人信息）
SELECT 
  'admin_2' as account_type,
  id,
  email,
  full_name,
  role,
  work_wechat_userid,
  created_at
FROM profiles 
WHERE email = '第二个管理员邮箱@example.com'; -- ⚠️ 替换为实际邮箱

-- ============================================================================

-- 4️⃣ 检查用户的合同权限配置（可能影响数据访问）
SELECT 
  p.email,
  p.full_name,
  p.role,
  cp.contract_id,
  c.name as contract_name,
  cp.can_view,
  cp.can_edit,
  cp.can_approve
FROM profiles p
LEFT JOIN contract_permissions cp ON p.id = cp.user_id
LEFT JOIN contracts c ON cp.contract_id = c.id
WHERE p.role IN ('admin', 'finance')
ORDER BY p.created_at DESC, cp.created_at DESC;

-- ============================================================================

-- 5️⃣ 检查最新创建的管理员账号
-- 显示最近7天创建的管理员和财务账号
SELECT 
  id,
  email,
  full_name,
  role,
  created_at,
  work_wechat_userid,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_since_created
FROM profiles
WHERE role IN ('admin', 'finance')
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ============================================================================

-- 6️⃣ 快速修复：将特定用户设置为管理员（如果role不正确）
-- ⚠️ 谨慎使用：请先确认用户ID

-- UPDATE profiles 
-- SET role = 'admin'
-- WHERE email = '新管理员的邮箱@example.com';

-- ============================================================================

-- 7️⃣ 检查是否有其他权限控制表
-- 查看是否有自定义权限表影响访问

-- 检查角色模板表（如果有）
SELECT * FROM role_templates WHERE role = 'admin' LIMIT 5;

-- 检查用户权限表（如果有）
SELECT * FROM user_permissions 
WHERE user_id IN (
  SELECT id FROM profiles WHERE role IN ('admin', 'finance')
) LIMIT 20;

-- ============================================================================

-- 8️⃣ 检查profiles表结构，确认所有必需字段
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================

-- 9️⃣ 完整的权限诊断查询
-- 这个查询会显示用户的所有相关信息

WITH user_info AS (
  SELECT 
    id,
    email,
    full_name,
    role,
    created_at,
    work_wechat_userid
  FROM profiles
  WHERE role IN ('admin', 'finance')
)
SELECT 
  ui.email as "用户邮箱",
  ui.full_name as "姓名",
  ui.role as "角色",
  ui.created_at as "创建时间",
  ui.work_wechat_userid as "企业微信ID",
  COUNT(DISTINCT cp.contract_id) as "合同权限数量",
  CASE 
    WHEN ui.role = 'admin' THEN '✅ 应该能看到收款人信息'
    WHEN ui.role = 'finance' THEN '✅ 应该能看到收款人信息'
    ELSE '❌ 不应该看到收款人信息'
  END as "预期权限"
FROM user_info ui
LEFT JOIN contract_permissions cp ON ui.id = cp.user_id
GROUP BY ui.id, ui.email, ui.full_name, ui.role, ui.created_at, ui.work_wechat_userid
ORDER BY ui.created_at DESC;

-- ============================================================================

-- 🔟 检查特定邮箱的完整信息（替换邮箱后执行）
/*
SELECT 
  id as "用户ID",
  email as "邮箱",
  full_name as "姓名",
  role as "角色",
  created_at as "创建时间",
  updated_at as "更新时间",
  work_wechat_userid as "企业微信ID",
  CASE 
    WHEN role = 'admin' THEN '✅ 管理员 - 完全权限'
    WHEN role = 'finance' THEN '✅ 财务 - 完全权限'
    WHEN role = 'business' THEN '📋 业务 - 部分权限'
    WHEN role = 'operator' THEN '👤 操作员 - 基础权限'
    WHEN role = 'viewer' THEN '👁️ 查看者 - 只读权限'
    ELSE '❌ 角色未知'
  END as "权限说明"
FROM profiles
WHERE email = '新管理员邮箱@example.com'; -- ⚠️ 替换为实际邮箱
*/

