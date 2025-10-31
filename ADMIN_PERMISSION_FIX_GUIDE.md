# 管理员权限问题修复指南

## 🐛 问题现象

**症状**：新建的管理员账号在付款审核中看不到收款人信息

**影响**：
- 无法看到：收款人、收款银行账号、开户行名称、支行网点
- PDF导出时收款人信息列为空

---

## ✅ 已完成的修复

### 1. 前端代码修复 ✅

已修改2个文件，统一权限逻辑：

**src/pages/PaymentAudit.tsx:**
```typescript
// 修改前
const { isAdmin } = usePermissions();

// 修改后
const { isAdmin, isFinance } = usePermissions();
const canViewSensitive = isAdmin || isFinance;
```

**src/pages/PaymentRequestsList.tsx:**
```typescript
// 同样修改
const { isAdmin, isFinance } = usePermissions();
const canViewSensitive = isAdmin || isFinance;
```

---

## 🔍 诊断步骤

### 第1步：查找新建的管理员账号

在Supabase SQL Editor中执行：

```sql
-- 查看最近创建的所有账号
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 10;
```

**查找结果应该显示：**
- 新管理员的邮箱
- 角色（role）应该是 `admin` 或 `finance`
- 创建时间

---

### 第2步：检查该账号的角色配置

**用实际邮箱替换后执行：**

```sql
SELECT 
  email,
  full_name,
  role,
  CASE 
    WHEN role = 'admin' THEN '✅ 正确 - 应该能看到收款人信息'
    WHEN role = 'finance' THEN '✅ 正确 - 应该能看到收款人信息'
    WHEN role IS NULL THEN '❌ 错误 - role为空'
    ELSE '❌ 错误 - 角色不正确: ' || role
  END as diagnosis
FROM profiles
WHERE email = '新管理员的邮箱@example.com'; -- ⚠️ 替换为实际邮箱
```

**检查点：**
- ✅ role = 'admin' → 正确
- ✅ role = 'finance' → 正确  
- ❌ role = NULL → 需要修复
- ❌ role = 'viewer' → 需要修复
- ❌ role = 'Admin'（大写）→ 需要修复

---

### 第3步：修复角色配置（如果有问题）

**如果第2步发现role不正确，执行修复：**

```sql
-- 修复为管理员角色
UPDATE profiles 
SET role = 'admin'
WHERE email = '新管理员的邮箱@example.com'; -- ⚠️ 替换为实际邮箱

-- 验证修复结果
SELECT 
  email,
  full_name,
  role,
  '✅ 已修复为管理员' as status
FROM profiles
WHERE email = '新管理员的邮箱@example.com'; -- ⚠️ 替换为实际邮箱
```

---

### 第4步：最终验证

```sql
-- 完整权限验证
SELECT 
  email as "用户邮箱",
  full_name as "姓名",
  role as "角色",
  CASE 
    WHEN role IN ('admin', 'finance') THEN '✅ 能看到收款人信息'
    ELSE '❌ 看不到收款人信息'
  END as "收款人信息权限",
  CASE 
    WHEN role IN ('admin', 'finance') THEN '✅ 可以访问付款审核'
    ELSE '❌ 无法访问付款审核'
  END as "页面访问权限"
FROM profiles
WHERE email = '新管理员的邮箱@example.com'; -- ⚠️ 替换为实际邮箱
```

---

## 🎯 快速修复方案

### 方案1：如果role字段错误

```sql
-- 一行命令修复
UPDATE profiles SET role = 'admin' WHERE email = '邮箱@example.com';
```

### 方案2：如果是大小写问题

```sql
-- 修复大小写
UPDATE profiles SET role = LOWER(role) WHERE email = '邮箱@example.com';
```

### 方案3：批量修复多个管理员

```sql
-- 批量设置为管理员
UPDATE profiles 
SET role = 'admin'
WHERE email IN (
  '管理员1@example.com',
  '管理员2@example.com',
  '管理员3@example.com'
);
```

---

## 🔍 常见问题排查

### 问题1：role字段为NULL

**原因**：创建用户时没有设置role

**修复**：
```sql
UPDATE profiles SET role = 'admin' WHERE email = '邮箱' AND role IS NULL;
```

### 问题2：role拼写错误

**原因**：role字段值不是标准的小写

**检查**：
```sql
SELECT email, role, LOWER(role) as corrected_role
FROM profiles
WHERE role ILIKE '%admin%' AND role != 'admin';
```

**修复**：
```sql
UPDATE profiles SET role = 'admin' WHERE role ILIKE 'admin';
```

### 问题3：缓存问题

**原因**：前端缓存了旧的用户信息

**解决**：
1. 清除浏览器缓存
2. 退出登录
3. 重新登录
4. 刷新页面

---

## 📝 使用我创建的SQL脚本

我已经为您创建了3个SQL脚本：

### 1. check_admin_permissions.sql
**用途**：全面检查所有管理员权限
```bash
位置：scripts/check_admin_permissions.sql
包含10个诊断查询
```

### 2. fix_admin_permissions.sql  
**用途**：修复角色配置问题
```bash
位置：scripts/fix_admin_permissions.sql
包含详细的修复步骤
```

### 3. admin_permission_diagnostic.sql
**用途**：完整诊断流程
```bash
位置：scripts/admin_permission_diagnostic.sql
一步步诊断和修复
```

---

## 🚀 快速执行步骤

### 步骤1：在Supabase打开SQL Editor

1. 登录 Supabase Dashboard
2. 选择项目
3. 点击左侧菜单 "SQL Editor"

### 步骤2：执行诊断查询

复制以下SQL并**替换邮箱**后执行：

```sql
-- 快速诊断
SELECT 
  email,
  full_name,
  role,
  CASE 
    WHEN role IN ('admin', 'finance') THEN '✅ 权限正确'
    ELSE '❌ 权限不正确：' || COALESCE(role, 'NULL')
  END as status
FROM profiles
WHERE email = '新管理员邮箱@example.com'; -- ⚠️ 替换这里
```

### 步骤3：如果role不正确，执行修复

```sql
-- 修复为管理员
UPDATE profiles 
SET role = 'admin'
WHERE email = '新管理员邮箱@example.com'; -- ⚠️ 替换这里
```

### 步骤4：验证修复

```sql
-- 确认修复成功
SELECT 
  email,
  full_name,
  role,
  '✅ 修复完成！现在应该能看到收款人信息了' as message
FROM profiles
WHERE email = '新管理员邮箱@example.com'; -- ⚠️ 替换这里
  AND role = 'admin';
```

### 步骤5：前端测试

1. 让新管理员**退出登录**
2. 清除浏览器缓存（Ctrl + Shift + Delete）
3. 重新登录
4. 进入"审核管理" → "付款审核"
5. 点击任意申请单的"生成PDF"
6. 查看PDF中的"收款人信息"列

---

## 📊 预期结果

修复后，新管理员应该能看到：

| 列名 | 应该显示的内容 |
|------|--------------|
| **收款人** | 合作方全称（如：中科智运云南供应链科技有限公司） |
| **收款银行账号** | 银行账号（如：23050186585300000478） |
| **开户行名称** | 银行名称（如：中国建设银行） |
| **支行网点** | 支行名称（如：中国建设银行股份有限公司临沧市新南路分理处） |

---

## ⚠️ 如果修复后还是不行

### 可能的其他原因：

1. **usePermissions Hook问题**
   - 检查 `src/hooks/usePermissions.ts`
   - 确认 `isAdmin` 和 `isFinance` 的判断逻辑

2. **Auth Context问题**
   - 检查 `src/contexts/AuthContext.tsx`
   - 确认user对象中role的更新

3. **数据库RPC函数权限**
   - 检查 `get_payment_request_export_data` 函数
   - 确认该函数的RLS策略

4. **浏览器缓存**
   - 完全清除缓存
   - 使用无痕模式测试

---

## 💡 提示

**最快的诊断方法：**

在Supabase SQL Editor中执行：
```sql
SELECT email, full_name, role FROM profiles 
WHERE email LIKE '%@%' AND created_at > NOW() - INTERVAL '7 days' 
ORDER BY created_at DESC;
```

找到新建管理员的邮箱，然后：
```sql
UPDATE profiles SET role = 'admin' WHERE email = '找到的邮箱';
```

**完成！** ✅

---

## 📞 需要帮助？

如果以上步骤都执行了还是不行，请提供：
1. 新管理员的邮箱（可以脱敏）
2. SQL查询的返回结果
3. 浏览器控制台的错误信息

我会进一步帮您排查！

