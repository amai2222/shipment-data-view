# 自动获取第三方平台 Token 说明

## 📋 概述

由于第三方平台（ZKZY）的 Token 会定期过期，我们创建了自动登录获取 Token 的功能。

## 🔧 功能说明

### 1. Edge Function: `get-tracking-token`

**位置**: `supabase/functions/get-tracking-token/index.ts`

**功能**: 自动登录第三方平台并获取 Auth-Session Token

**支持的登录类型**:
- `add`: 添加车辆登录（用户名：carquery）
- `query`: 查询车辆登录（用户名：cladmin）

### 2. 前端刷新 Token 按钮

在车辆轨迹查询页面（`VehicleTracking`）添加了两个按钮：
- **刷新添加Token**: 获取添加车辆用的 Token
- **刷新查询Token**: 获取查询车辆用的 Token

## 🚀 使用方法

### 方法1：通过前端界面刷新（推荐）

1. 打开车辆轨迹查询页面
2. 点击页面顶部的 **"刷新添加Token"** 或 **"刷新查询Token"** 按钮
3. 等待 Token 获取成功
4. Token 会自动复制到剪贴板
5. 登录 Supabase Dashboard，更新相应的环境变量：
   - 添加车辆 Token → `TRACKING_ADD_TOKEN`
   - 查询车辆 Token → `TRACKING_AUTH_SESSION`

### 方法2：通过 API 调用

```typescript
// 获取添加车辆 Token
const { data, error } = await supabase.functions.invoke('get-tracking-token', {
  body: { type: 'add' }
});

// 获取查询车辆 Token
const { data, error } = await supabase.functions.invoke('get-tracking-token', {
  body: { type: 'query' }
});
```

## ⚙️ 环境变量配置

### Supabase Dashboard 环境变量

在 Supabase Dashboard → Project Settings → Edge Functions → Secrets 中配置：

#### 添加车辆相关
- `TRACKING_ADD_USERNAME`: 添加车辆用户名（默认：carquery）
- `TRACKING_ADD_PASSWORD`: 添加车辆密码（默认：Zk19090323j）
- `TRACKING_ADD_TOKEN`: 添加车辆 Token（通过刷新获取）

#### 查询车辆相关
- `TRACKING_QUERY_USERNAME`: 查询车辆用户名（默认：cladmin）
- `TRACKING_QUERY_PASSWORD`: 查询车辆密码（默认：Zk16120325j）
- `TRACKING_AUTH_SESSION`: 查询车辆 Token（通过刷新获取）

## 🔍 工作原理

1. **访问登录页面**: 首先访问登录页面，获取初始 Cookie
2. **尝试登录 API**: 尝试多个可能的登录 API 端点
3. **提取 Token**: 从响应头（Set-Cookie）或响应体中提取 Auth-Session Token
4. **返回 Token**: 将 Token 返回给调用者

## ⚠️ 注意事项

### 1. 登录 API 端点可能变化

由于第三方平台可能使用前端 JavaScript 进行登录，直接通过 HTTP 请求可能无法成功。如果自动登录失败：

1. **手动获取 Token**:
   - 打开浏览器开发者工具（F12）
   - 访问登录页面并登录
   - 在 Network 标签页中找到任意请求
   - 查看请求头中的 `Auth-Session` 或 Cookie 中的 `Auth-Session` 值
   - 复制 Token 值

2. **更新环境变量**:
   - 登录 Supabase Dashboard
   - 进入 Project Settings → Edge Functions → Secrets
   - 更新 `TRACKING_ADD_TOKEN` 或 `TRACKING_AUTH_SESSION`

### 2. Token 有效期

- Token 会定期过期（具体时间由第三方平台决定）
- 建议定期检查 Token 是否有效
- 如果遇到 401/403 错误，说明 Token 已过期，需要刷新

### 3. 安全性

- **不要**将用户名和密码硬编码在代码中
- **使用**环境变量存储敏感信息
- **定期**更新密码（如果可能）

## 🐛 故障排除

### 问题1：自动登录失败

**可能原因**:
- 登录 API 端点已更改
- 需要验证码
- 用户名或密码错误

**解决方案**:
1. 检查环境变量中的用户名和密码是否正确
2. 尝试手动登录获取 Token
3. 查看 Edge Function 日志，了解具体错误信息

### 问题2：获取的 Token 无效

**可能原因**:
- Token 格式不正确
- Token 已过期
- 提取逻辑有误

**解决方案**:
1. 检查 Token 格式是否正确（应该以 `#` 开头）
2. 尝试手动获取 Token 进行对比
3. 查看 Edge Function 日志，确认提取的 Token 值

### 问题3：Token 刷新后仍然报错

**可能原因**:
- 环境变量未正确更新
- 需要重新部署 Edge Function
- Token 类型不匹配（添加 vs 查询）

**解决方案**:
1. 确认环境变量已正确更新
2. 重新部署相关的 Edge Function
3. 确认使用的 Token 类型正确

## 📝 相关文件

- Edge Function: `supabase/functions/get-tracking-token/index.ts`
- 共享工具: `supabase/functions/_shared/get-tracking-token.ts`
- 前端页面: `src/pages/VehicleTracking.tsx`
- 添加车辆函数: `supabase/functions/add-vehicle/index.ts`
- 同步车辆函数: `supabase/functions/sync-vehicle/index.ts`
- 查询轨迹函数: `supabase/functions/vehicle-tracking/index.ts`

## 🔄 更新日志

- **2025-01-XX**: 创建自动获取 Token 功能
- 支持两种登录类型（添加/查询）
- 添加前端刷新 Token 按钮
- 自动复制 Token 到剪贴板

