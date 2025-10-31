# 创建管理员账号失败修复指南

## 🐛 问题现象

**错误信息**：`Edge Function returned a non-2xx status code`

**症状**：
- ✅ 创建其他角色（业务、财务、操作员、查看者）成功
- ❌ 创建"系统管理员"角色失败

**原因**：`profiles`表的RLS（行级安全）策略阻止了Edge Function插入admin角色的记录

---

## 🚀 快速修复方法（推荐）

### 在Supabase SQL Editor中执行以下SQL：

```sql
-- 第1步：删除限制性策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 第2步：创建允许service_role插入的策略
CREATE POLICY IF NOT EXISTS "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (
  -- Edge Function使用service_role，应该被允许创建任何角色
  auth.role() = 'service_role'
);

-- 第3步：验证策略创建成功
SELECT 
  policyname,
  cmd,
  '✅ 已创建' as status
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'INSERT';
```

---

## 📋 详细执行步骤

### 步骤1：登录Supabase Dashboard

1. 打开 https://supabase.com
2. 登录您的账号
3. 选择项目

### 步骤2：打开SQL Editor

1. 点击左侧菜单 "SQL Editor"
2. 点击 "+ New query"

### 步骤3：执行修复SQL

复制并执行以下完整SQL：

```sql
-- ============================================================================
-- 快速修复：允许Edge Function创建admin用户
-- ============================================================================

BEGIN;

-- 删除可能限制的旧策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 创建新策略：允许service_role（Edge Function）插入
CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- 确保RLS已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 验证
SELECT 
  '✅ 修复完成' as message,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'INSERT';
```

### 步骤4：测试创建管理员

1. 返回应用的"用户管理"页面
2. 点击"+ 新建用户"
3. 填写信息：
   - 邮箱：gry@qq.com（或其他邮箱）
   - 姓名：高锐阳
   - 角色：**系统管理员**
   - 密码：设置密码
4. 点击"创建用户"

**预期结果**：✅ 创建成功

---

## 🔍 如果还是失败

### 方法1：查看Edge Function日志

1. 在Supabase Dashboard中
2. 点击左侧 "Edge Functions"
3. 找到 "create-user" 函数
4. 点击 "Logs" 标签
5. 查看最近的错误日志
6. 截图发给我

### 方法2：检查具体错误

在浏览器中：
1. 按F12打开开发者工具
2. 切换到"Console"标签
3. 再次尝试创建管理员
4. 查看红色错误信息
5. 告诉我完整的错误信息

### 方法3：使用诊断SQL

执行我创建的诊断脚本：
```bash
位置：scripts/diagnose_create_admin_issue.sql
```

将结果告诉我，我会进一步分析。

---

## 🎯 常见错误和解决方案

### 错误1：RLS策略阻止

**症状**：`new row violates row-level security policy`

**解决**：执行上面的快速修复SQL

### 错误2：角色名称错误

**症状**：`invalid role`

**检查**：
```sql
-- 查看有效的角色列表
SELECT DISTINCT role, COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;
```

### 错误3：邮箱已存在

**症状**：`Email already registered` 或 `该邮箱已被注册`

**解决**：
```sql
-- 检查邮箱是否存在
SELECT email, full_name, role FROM profiles WHERE email = 'gry@qq.com';

-- 如果存在且要删除，执行：
-- DELETE FROM auth.users WHERE email = 'gry@qq.com';
-- DELETE FROM profiles WHERE email = 'gry@qq.com';
```

### 错误4：密码太弱

**症状**：`Password should be at least 6 characters`

**解决**：使用更强的密码（至少6位）

---

## 💡 临时解决方案（如果SQL修复不work）

### 方案A：直接在数据库创建

```sql
-- 在Supabase SQL Editor中执行

-- 1. 创建认证用户（在auth.users表）
-- 注意：这需要service_role权限

-- 2. 创建profile记录
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(), -- 或使用已创建的auth user的ID
  'gry@qq.com',
  '高锐阳',
  'admin',
  true,
  NOW(),
  NOW()
);

-- 注意：这种方法需要手动在auth.users表中创建对应的认证记录
```

### 方案B：使用Supabase Dashboard

1. 在Supabase Dashboard中
2. 点击左侧 "Authentication"
3. 点击 "Users" 标签
4. 点击 "Add user" → "Create new user"
5. 填写邮箱和密码
6. 创建成功后，在SQL Editor中执行：

```sql
-- 更新刚创建用户的role为admin
UPDATE profiles 
SET role = 'admin', full_name = '高锐阳'
WHERE email = 'gry@qq.com';
```

---

## 📊 完整的诊断和修复流程

### 步骤1：执行诊断SQL
```bash
文件：scripts/diagnose_create_admin_issue.sql
```

### 步骤2：执行修复SQL
```bash
文件：scripts/fix_create_admin_user.sql
```

### 步骤3：清除缓存并测试
1. 清除浏览器缓存
2. 刷新用户管理页面
3. 创建管理员账号

### 步骤4：如果仍失败
将以下信息提供给我：
1. SQL执行结果
2. 浏览器控制台错误
3. Edge Function日志截图

---

## ✅ 预期修复后的效果

修复后，应该能够：
- ✅ 创建系统管理员账号
- ✅ 创建所有其他角色账号
- ✅ Edge Function正常工作
- ✅ 无RLS策略阻止

---

## 🎯 核心修复SQL（复制执行）

```sql
-- 一键修复
BEGIN;

-- 删除限制性策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;

-- 创建宽松策略
CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 确保RLS启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 验证
SELECT '✅ 修复完成！现在可以创建管理员账号了' as message;
```

**执行后，立即测试创建管理员账号！**

---

## 📞 还需要帮助？

如果执行后还是不行，请告诉我：

1. **SQL执行结果** - 复制粘贴给我
2. **浏览器错误** - F12控制台的完整错误
3. **Edge Function日志** - Supabase Dashboard中的日志

我会进一步帮您分析！💪

