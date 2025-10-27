# 用户创建ID冲突问题修复说明

## 问题描述

**错误信息**:
```
ERROR: 创建用户失败：{ code: "23505", details: "Key (id)=(50480447-f66d-4268-9241-ca4dddeа5bbb) already exists."
```

**错误代码**: 23505 (PostgreSQL唯一约束冲突)

---

## 问题原因

### 数据不一致状态

1. **之前的创建流程**:
   ```
   创建认证用户（auth.users）成功
       ↓
   插入用户档案（profiles）失败（网络中断/权限问题等）
       ↓
   结果：auth.users中有记录，profiles中没有记录
   ```

2. **再次尝试创建相同邮箱**:
   ```
   检查邮箱是否存在 → profiles表中查询 → 未找到 ✓
       ↓
   创建认证用户 → 邮箱已存在 → 返回现有用户 ✓
       ↓
   插入用户档案 → ID已存在 → 唯一约束冲突 ❌
   ```

### 为什么会ID冲突？

Edge Function的逻辑：
```typescript
// 1. 创建认证用户
const { data: authData } = await supabaseAdmin.auth.admin.createUser({
  email: email,
  password: password
});
// 如果邮箱已存在，Supabase会返回现有用户而不是报错

// 2. 插入profiles（使用.insert()）
const { data: profileData, error } = await supabaseAdmin
  .from('profiles')
  .insert({
    id: authData.user.id,  // ← 这个ID可能已存在
    email: email,
    ...
  });
// 如果ID已存在，.insert()会报错23505
```

---

## 解决方案

### 修改Edge Function使用UPSERT

**修改文件**: `supabase/functions/create-user/index.ts`

**修改前**（第191-203行）:
```typescript
const { data: profileData, error: createProfileError } = await supabaseAdmin
  .from('profiles')
  .insert({
    id: authData.user.id,
    email: requestData.email,
    full_name: requestData.full_name,
    role: requestData.role,
    phone: requestData.phone || null,
    work_wechat_userid: requestData.work_wechat_userid || null,
    is_active: true
  })
  .select()
  .single();
```

**修改后**:
```typescript
const { data: profileData, error: createProfileError } = await supabaseAdmin
  .from('profiles')
  .upsert({
    id: authData.user.id,
    email: requestData.email,
    full_name: requestData.full_name,
    role: requestData.role,
    phone: requestData.phone || null,
    work_wechat_userid: requestData.work_wechat_userid || null,
    is_active: true,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'id'  // 如果ID冲突，则更新
  })
  .select()
  .single();
```

---

## INSERT vs UPSERT

### INSERT（旧方式）
```sql
INSERT INTO profiles (id, email, ...)
VALUES ('xxx', 'user@example.com', ...);

-- 如果ID已存在 → ERROR 23505
```

### UPSERT（新方式）
```sql
INSERT INTO profiles (id, email, ...)
VALUES ('xxx', 'user@example.com', ...)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  ...;

-- 如果ID已存在 → 更新现有记录 ✓
-- 如果ID不存在 → 插入新记录 ✓
```

---

## 部署修复

### 步骤1：修改Edge Function

✅ 已完成：将 `.insert()` 改为 `.upsert()`

### 步骤2：重新部署Edge Function

运行以下命令：

```powershell
# 方法1：使用部署脚本
.\deploy-create-user-function.ps1

# 方法2：直接使用Supabase CLI
supabase functions deploy create-user --no-verify-jwt

# 方法3：部署所有函数
supabase functions deploy
```

### 步骤3：测试功能

1. 打开用户管理页面
2. 点击"新建用户"
3. 填写信息（可以使用之前失败的邮箱）
4. 点击"创建用户"
5. 应该成功创建

---

## 预防措施

### 1. 事务处理

理想情况下，应该使用事务确保认证用户和档案创建的原子性：

```typescript
// 伪代码
BEGIN TRANSACTION;
  创建认证用户
  创建用户档案
  如果任何一步失败 → ROLLBACK
COMMIT;
```

但Supabase的auth.admin API不支持事务，所以使用UPSERT是最佳方案。

### 2. 错误恢复

如果创建过程中出错，Edge Function会自动回滚：

```typescript
if (createProfileError) {
  // 删除已创建的认证用户
  await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
  
  return error response;
}
```

### 3. 数据清理

定期检查并清理孤立的认证用户：

```sql
-- 查找孤立的认证用户（在auth.users中但不在profiles中）
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 清理孤立用户（谨慎操作！）
-- DELETE FROM auth.users WHERE id IN (...);
```

---

## 测试场景

### 场景1：正常创建新用户
```
输入：test1@example.com, password123, 张三, viewer
预期：✓ 用户创建成功
结果：✓ auth.users和profiles都有记录
```

### 场景2：重复邮箱
```
输入：test1@example.com（已存在）
预期：✗ 提示"该邮箱已被注册"
结果：✓ 正确拒绝
```

### 场景3：ID已存在但邮箱不存在（修复前会失败）
```
状态：auth.users中有ID为xxx的记录，但profiles中没有
输入：使用不同邮箱创建用户
修复前：✗ 报错23505 ID冲突
修复后：✓ 成功创建/更新profiles记录
```

---

## 监控和日志

### 查看Edge Function日志

在Supabase Dashboard：
1. 进入 Edge Functions
2. 点击 `create-user`
3. 查看 Logs 标签

### 常见日志

**成功**:
```
INFO: 开始创建用户: user@example.com
INFO: 认证用户创建成功，ID: xxx
INFO: 用户创建完成: {...}
```

**失败**:
```
ERROR: 创建认证用户失败: Email already registered
ERROR: 创建用户档案失败: Key (id)=(...) already exists
ERROR: 权限不足：只有管理员可以创建用户
```

---

## 后续优化建议

### 1. 添加邮箱验证检查

在创建用户前，同时检查auth.users和profiles：

```typescript
// 检查邮箱是否在认证系统中存在
const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
const existsInAuth = authUsers.users.some(u => u.email === requestData.email);

// 检查邮箱是否在profiles中存在  
const { data: existingProfile } = await supabaseAdmin
  .from('profiles')
  .select('email')
  .eq('email', requestData.email)
  .maybeSingle();

if (existsInAuth || existingProfile) {
  return error('该邮箱已被注册');
}
```

### 2. 批量修复孤立用户

创建一个修复脚本，将auth.users中存在但profiles中不存在的用户同步：

```sql
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  COALESCE(au.raw_user_meta_data->>'role', 'viewer'),
  true
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

## 立即执行

### 修复已完成 ✅

1. Edge Function代码已修改（使用upsert）
2. 需要重新部署Edge Function

### 部署命令

```powershell
supabase functions deploy create-user --no-verify-jwt
```

### 测试方法

1. 部署后刷新用户管理页面
2. 尝试创建新用户
3. 应该成功创建

---

**修复日期**: 2025-10-27  
**修改文件**: `supabase/functions/create-user/index.ts` (第191-203行)  
**状态**: ✅ 代码已修复，需要重新部署Edge Function

