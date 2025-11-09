# Supabase会话过期时间配置说明

## 📋 问题

用户反映网页闲置一段时间后，点击其他页面会报错，需要刷新才能恢复。这是因为Supabase的JWT token有过期时间。

## 🔍 Supabase默认配置

Supabase的JWT token过期时间配置：

- **access_token（访问令牌）**：默认 **1小时** 过期
- **refresh_token（刷新令牌）**：默认 **30天** 过期（或更长，取决于Supabase项目配置）

## ✅ 解决方案

### 方案1：在Supabase Dashboard中修改JWT过期时间（推荐）

1. 登录 Supabase Dashboard
2. 进入项目设置：**Settings** → **API** → **JWT Settings**
3. 找到 **JWT expiry** 或 **Access Token Expiry** 设置
4. 将过期时间从默认的 `3600` 秒（1小时）改为更长的值，例如：
   - `86400` = 1天
   - `604800` = 7天
   - `2592000` = 30天
   - `31536000` = 1年（不推荐，安全风险较高）

### 方案2：修改refresh_token过期时间

1. 在Supabase Dashboard中：**Settings** → **Auth** → **URL Configuration**
2. 找到 **Refresh Token Rotation** 或 **Session Duration** 设置
3. 将refresh_token的过期时间设置为更长的值（例如90天或更长）

### 方案3：使用前端自动刷新（当前已实现）

前端代码已经配置了 `autoRefreshToken: true`，Supabase会自动在access_token过期前刷新它。只要refresh_token还在有效期内，session就不会过期。

**当前配置：**
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true, // ✅ 已启用自动刷新
  }
});
```

## 🎯 推荐配置

为了确保"不退出不过期"，建议：

1. **access_token过期时间**：设置为 `86400` 秒（1天）
2. **refresh_token过期时间**：设置为 `7776000` 秒（90天）或更长
3. **保持 `autoRefreshToken: true`**：确保自动刷新机制正常工作

## 📝 注意事项

1. **安全性**：过长的过期时间可能增加安全风险，建议根据实际需求平衡安全性和用户体验
2. **自动刷新**：只要refresh_token有效，Supabase会自动刷新access_token，用户无需重新登录
3. **主动退出**：只有用户主动点击"退出"按钮时，才会清除session并跳转到登录页

## 🔧 如何修改

### 在Supabase Dashboard中修改：

1. 登录 https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **Settings** → **API**
4. 找到 **JWT Settings** 部分
5. 修改 **JWT expiry** 值（单位：秒）
6. 保存更改

### 或者使用SQL修改（需要管理员权限）：

```sql
-- 注意：Supabase的JWT配置通常在项目设置中，不是通过SQL修改
-- 但可以通过修改auth.users表的配置来影响session行为
```

---

**总结**：最简单的方法是直接在Supabase Dashboard中将JWT过期时间设置得更长（例如1天或7天），配合前端的`autoRefreshToken: true`，就能实现"不退出不过期"的效果。

