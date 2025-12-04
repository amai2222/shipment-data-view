# Supabase Edge Functions 部署指南

## 📋 概述

本指南将帮助您部署更新后的 Edge Functions 到 Supabase，包括：
- `get-tracking-token` - 自动登录获取 Token
- `add-vehicle` - 添加车辆（已集成自动登录）
- `sync-vehicle` - 同步车辆（已集成自动登录）

## 🚀 部署步骤

### 方法1：使用 Supabase CLI（推荐）

#### 步骤1：安装 Supabase CLI

如果还没有安装 Supabase CLI，请先安装：

```bash
# Windows (使用 Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 或使用 npm
npm install -g supabase

# 或使用其他方式，参考：https://supabase.com/docs/guides/cli
```

#### 步骤2：登录 Supabase

```bash
supabase login
```

这会打开浏览器，让您登录 Supabase 账号。

#### 步骤3：链接项目

```bash
# 在项目根目录执行
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` 可以在 Supabase Dashboard 的项目设置中找到（格式类似：`abcdefghijklmnop`）。

#### 步骤4：部署 Edge Functions

```bash
# 部署所有更新的函数
supabase functions deploy get-tracking-token
supabase functions deploy add-vehicle
supabase functions deploy sync-vehicle

# 或者一次性部署所有函数
supabase functions deploy
```

#### 步骤5：配置环境变量（可选）

虽然代码中已经包含了默认的用户名和密码，但为了安全，建议通过环境变量配置：

```bash
# 设置添加车辆账号密码
supabase secrets set PWD_ADD=Zk19090323j

# 设置查询车辆账号密码
supabase secrets set PWD_QUERY=Zk16120325j

# 或者使用旧的环境变量名（向后兼容）
supabase secrets set TRACKING_ADD_PASSWORD=Zk19090323j
supabase secrets set TRACKING_QUERY_PASSWORD=Zk16120325j
```

**注意**：如果不想在代码中硬编码密码，建议设置这些环境变量。

### 方法2：通过 Supabase Dashboard（Web界面）

#### 步骤1：登录 Supabase Dashboard

1. 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. 选择您的项目

#### 步骤2：上传 Edge Functions

1. 进入 **Edge Functions** 页面
2. 点击 **Create a new function** 或选择现有函数
3. 对于每个函数：
   - 复制函数代码（从 `supabase/functions/<function-name>/index.ts`）
   - 粘贴到编辑器中
   - 点击 **Deploy**

#### 步骤3：配置环境变量

1. 进入 **Project Settings** → **Edge Functions** → **Secrets**
2. 添加以下环境变量（可选）：
   - `PWD_ADD` = `Zk19090323j`
   - `PWD_QUERY` = `Zk16120325j`
   - 或使用旧名称：
     - `TRACKING_ADD_PASSWORD` = `Zk19090323j`
     - `TRACKING_QUERY_PASSWORD` = `Zk16120325j`

## 🔍 验证部署

### 1. 检查函数是否部署成功

在 Supabase Dashboard 中：
1. 进入 **Edge Functions** 页面
2. 确认以下函数存在且状态为 **Active**：
   - `get-tracking-token`
   - `add-vehicle`
   - `sync-vehicle`

### 2. 测试函数

#### 测试 get-tracking-token

```bash
# 测试获取添加车辆 Token
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/get-tracking-token \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"type": "add"}'

# 测试获取查询车辆 Token
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/get-tracking-token \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"type": "query"}'
```

#### 测试 add-vehicle

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/add-vehicle \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "licensePlate": "测试车牌",
    "loadWeight": "10"
  }'
```

#### 测试 sync-vehicle

```bash
# 测试只添加车辆
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/sync-vehicle \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "licensePlate": "测试车牌",
    "loadWeight": "10"
  }'

# 测试添加并同步ID
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/sync-vehicle \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "licensePlate": "测试车牌",
    "loadWeight": "10",
    "syncId": true
  }'
```

### 3. 查看日志

在 Supabase Dashboard 中：
1. 进入 **Edge Functions** 页面
2. 选择要查看的函数
3. 点击 **Logs** 标签页
4. 查看函数执行日志，确认：
   - 登录是否成功
   - Token 是否正常获取
   - 是否有错误信息

## 📝 环境变量说明

### 必需的环境变量

以下环境变量由 Supabase 自动提供，无需手动配置：
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase 服务角色密钥

### 可选的环境变量

以下环境变量用于覆盖默认的登录凭据（可选）：

| 环境变量名 | 说明 | 默认值 |
|-----------|------|--------|
| `PWD_ADD` 或 `TRACKING_ADD_PASSWORD` | 添加车辆账号密码 | `Zk19090323j` |
| `PWD_QUERY` 或 `TRACKING_QUERY_PASSWORD` | 查询车辆账号密码 | `Zk16120325j` |

**注意**：
- 如果设置了环境变量，将优先使用环境变量的值
- 如果不设置环境变量，将使用代码中的默认值
- 为了安全，建议在生产环境中使用环境变量

### 已废弃的环境变量

以下环境变量不再需要（系统会自动登录获取）：
- ~~`TRACKING_ADD_TOKEN`~~ - 不再需要，系统自动获取
- ~~`TRACKING_AUTH_SESSION`~~ - 不再需要，系统自动获取

但如果自动登录失败，系统仍会尝试使用这些环境变量作为降级方案。

## 🔄 更新部署

当代码更新后，重新部署：

```bash
# 部署单个函数
supabase functions deploy <function-name>

# 部署所有函数
supabase functions deploy
```

## 🐛 故障排除

### 问题1：部署失败

**可能原因**：
- CLI 未正确安装
- 未登录 Supabase
- 项目未正确链接

**解决方案**：
```bash
# 检查 CLI 版本
supabase --version

# 重新登录
supabase login

# 重新链接项目
supabase link --project-ref <your-project-ref>
```

### 问题2：函数执行失败

**可能原因**：
- 环境变量未正确配置
- 网络连接问题
- 第三方平台登录失败

**解决方案**：
1. 检查 Edge Function 日志
2. 确认环境变量是否正确设置
3. 测试网络连接
4. 验证登录凭据是否正确

### 问题3：Token 获取失败

**可能原因**：
- 用户名或密码错误
- 第三方平台 API 变更
- 网络问题

**解决方案**：
1. 检查环境变量中的用户名和密码
2. 查看 Edge Function 日志中的详细错误信息
3. 尝试手动登录验证凭据是否正确
4. 检查第三方平台是否有更新

## 📚 相关文档

- [Supabase CLI 文档](https://supabase.com/docs/guides/cli)
- [Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [环境变量配置](https://supabase.com/docs/guides/functions/secrets)

## ✅ 部署检查清单

- [ ] Supabase CLI 已安装
- [ ] 已登录 Supabase
- [ ] 项目已正确链接
- [ ] `get-tracking-token` 函数已部署
- [ ] `add-vehicle` 函数已部署
- [ ] `sync-vehicle` 函数已部署
- [ ] 环境变量已配置（可选）
- [ ] 函数测试通过
- [ ] 日志检查无错误

---

**最后更新**：2025-01-XX  
**维护者**：开发团队

