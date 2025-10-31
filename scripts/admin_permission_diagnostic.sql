-- ============================================================================
-- 管理员权限诊断脚本
-- 用于全面诊断新建管理员账号为什么看不到收款人信息
-- ============================================================================

-- 📋 使用方法：
-- 1. 将 '新管理员邮箱@example.com' 替换为实际的用户邮箱
-- 2. 在Supabase SQL Editor中执行
-- 3. 查看诊断结果

-- ============================================================================
-- 第一部分：基础信息检查
-- ============================================================================

-- 1. 查看该用户的基础信息
SELECT 
  '🔍 基础信息检查' as check_type,
  id as user_id,
  email,
  full_name,
  role,
  created_at,
  updated_at
FROM profiles
WHERE email = '新管理员邮箱@example.com' -- ⚠️ 替换为实际邮箱
   OR full_name LIKE '%新管理员姓名%'; -- ⚠️ 或者用姓名查找

-- ============================================================================

-- 2. 检查角色配置是否正确
SELECT 
  '🎭 角色检查' as check_type,
  email,
  full_name,
  role,
  CASE 
    WHEN role = 'admin' THEN '✅ 正确 - 应该有完全权限'
    WHEN role = 'finance' THEN '✅ 正确 - 应该有完全权限'
    WHEN role IS NULL THEN '❌ 错误 - role为NULL'
    WHEN role = '' THEN '❌ 错误 - role为空'
    WHEN role = 'Admin' OR role = 'ADMIN' THEN '⚠️ 大小写错误 - 应该是小写admin'
    ELSE '❌ 错误 - 角色不正确: ' || role
  END as diagnosis,
  CASE 
    WHEN role IN ('admin', 'finance') THEN 'UPDATE profiles SET role = ''admin'' WHERE id = ''' || id || ''';'
    ELSE 'UPDATE profiles SET role = ''admin'' WHERE id = ''' || id || ''';'
  END as fix_sql
FROM profiles
WHERE email = '新管理员邮箱@example.com'; -- ⚠️ 替换为实际邮箱

-- ============================================================================
-- 第二部分：对比分析
-- ============================================================================

-- 3. 对比所有管理员和财务账号
SELECT 
  '👥 全部管理员对比' as check_type,
  email,
  full_name,
  role,
  created_at,
  work_wechat_userid,
  CASE 
    WHEN email = '新管理员邮箱@example.com' THEN '👈 这是新建的账号'
    ELSE '其他管理员'
  END as account_note
FROM profiles
WHERE role IN ('admin', 'finance')
ORDER BY created_at DESC;

-- ============================================================================

-- 4. 检查是否有额外的权限表
-- 某些系统可能有额外的权限控制表

-- 检查是否有user_permissions表
SELECT 
  '🔐 额外权限表检查' as check_type,
  table_name,
  '表存在' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%permission%' OR table_name LIKE '%role%')
ORDER BY table_name;

-- ============================================================================
-- 第三部分：快速修复方案
-- ============================================================================

-- 5. 快速修复SQL（需要替换邮箱后执行）

-- 方案A：按邮箱修复
/*
UPDATE profiles 
SET role = 'admin'
WHERE email = '新管理员邮箱@example.com';

-- 验证修复结果
SELECT 
  email,
  full_name,
  role,
  '✅ 已修复为管理员' as status
FROM profiles
WHERE email = '新管理员邮箱@example.com';
*/

-- 方案B：按ID修复
/*
UPDATE profiles 
SET role = 'admin'
WHERE id = '用户UUID';

-- 验证修复结果
SELECT 
  email,
  full_name,
  role,
  '✅ 已修复为管理员' as status
FROM profiles
WHERE id = '用户UUID';
*/

-- ============================================================================
-- 第四部分：验证修复
-- ============================================================================

-- 6. 修复后的最终验证
SELECT 
  '✅ 最终验证' as check_type,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✅ Admin - 完全权限 - 能看到收款人信息'
    WHEN p.role = 'finance' THEN '✅ Finance - 完全权限 - 能看到收款人信息'
    ELSE '❌ ' || p.role || ' - 权限不足'
  END as permission_status,
  CASE 
    WHEN p.role IN ('admin', 'finance') THEN '✅ 可以访问付款审核页面'
    ELSE '❌ 无法访问付款审核页面'
  END as page_access
FROM profiles p
WHERE p.email = '新管理员邮箱@example.com'; -- ⚠️ 替换为实际邮箱

-- ============================================================================
-- 使用说明
-- ============================================================================

/*
📖 完整诊断流程：

1️⃣ 替换邮箱
   将所有 '新管理员邮箱@example.com' 替换为实际用户邮箱

2️⃣ 执行诊断查询（第1-4部分）
   - 查看基础信息
   - 检查角色配置
   - 对比其他管理员
   - 检查额外权限表

3️⃣ 根据诊断结果修复（第3部分）
   - 如果role不正确，执行修复SQL
   - 如果role正确但还是没权限，检查前端代码

4️⃣ 验证修复结果（第4部分）
   - 确认角色已正确设置
   - 用该账号登录测试

5️⃣ 前端验证
   - 清除浏览器缓存
   - 重新登录
   - 进入付款审核页面
   - 查看PDF中的收款人信息

常见问题：
❓ role字段为NULL → 执行方案A/B修复
❓ role拼写错误（如Admin而不是admin） → 执行方案A/B修复
❓ role正确但前端还是没权限 → 检查usePermissions hook的实现
❓ 浏览器缓存问题 → 清除缓存重新登录
*/

