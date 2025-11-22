# Lovable 平台环境变量配置说明

## 🚨 问题说明

如果 Lovable 平台构建失败，错误信息显示：
```
Uncaught Error: 缺少必要的环境变量：请在 .env.local 文件中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
```

这是因为 Lovable 平台在构建时无法找到必要的环境变量。

## ✅ 解决方案

### 方法 1：在 Lovable 平台配置环境变量（推荐）

Lovable 平台需要在**项目设置**中配置环境变量，而不是在 `.env.local` 文件中。

#### 配置步骤：

1. **登录 Lovable 平台**
   - 访问 [Lovable.dev](https://lovable.dev)
   - 登录您的账号

2. **进入项目设置**
   - 选择您的项目
   - 进入 **Settings**（设置）或 **Environment Variables**（环境变量）页面

3. **添加环境变量**
   在环境变量配置页面，添加以下两个变量：

   ```
   VITE_SUPABASE_URL=你的Supabase项目URL
   VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
   ```

   **示例值**：
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **获取 Supabase 配置值**
   - 登录 [Supabase Dashboard](https://app.supabase.com)
   - 选择您的项目
   - 进入 **Settings** → **API**
   - 复制以下信息：
     - **Project URL** → 填入 `VITE_SUPABASE_URL`
     - **anon/public key** → 填入 `VITE_SUPABASE_ANON_KEY`

5. **保存并重新构建**
   - 保存环境变量配置
   - 触发新的构建（Lovable 平台通常会自动重新构建）

### 方法 2：创建本地 `.env.local` 文件（仅用于本地开发）

如果您需要在本地开发环境中使用，可以创建 `.env.local` 文件：

1. **创建 `.env.local` 文件**
   在项目根目录创建 `.env.local` 文件：

   ```env
   # Supabase 配置
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
   ```

2. **获取配置值**
   - 登录 Supabase Dashboard
   - 进入 **Settings** → **API**
   - 复制 **Project URL** 和 **anon/public key**

3. **验证配置**
   - 运行 `npm run dev` 启动开发服务器
   - 如果配置正确，应用应该能正常启动

## 📋 环境变量说明

### `VITE_SUPABASE_URL`
- **类型**: 字符串
- **格式**: `https://xxxxx.supabase.co`
- **说明**: Supabase 项目的 API URL
- **获取位置**: Supabase Dashboard → Settings → API → Project URL

### `VITE_SUPABASE_ANON_KEY`
- **类型**: 字符串
- **格式**: JWT Token（以 `eyJ` 开头）
- **说明**: Supabase 项目的匿名密钥（公开密钥，用于客户端）
- **获取位置**: Supabase Dashboard → Settings → API → anon/public key

## ⚠️ 重要提示

1. **不要提交敏感信息**
   - `.env.local` 文件已配置在 `.gitignore` 中，不会被提交到 Git
   - 但根据项目配置，`.env.local` 现在**可以提交到 GitHub**（如果团队需要共享配置）

2. **平台环境变量优先级**
   - Lovable 平台的环境变量配置会覆盖 `.env.local` 文件
   - 在 Lovable 平台配置环境变量是**必须的**，因为构建时无法访问本地文件

3. **安全性**
   - `VITE_SUPABASE_ANON_KEY` 是**公开密钥**，可以安全地暴露在客户端代码中
   - 但请确保 Supabase 项目已正确配置 **Row Level Security (RLS)** 策略

## 🔍 验证配置

配置完成后，可以通过以下方式验证：

1. **查看构建日志**
   - 在 Lovable 平台查看构建日志
   - 确认没有环境变量相关的错误

2. **检查应用运行**
   - 访问部署的应用
   - 确认应用能正常加载，没有报错

3. **检查浏览器控制台**
   - 打开浏览器开发者工具
   - 查看 Console 标签
   - 确认没有环境变量相关的错误

## 📞 需要帮助？

如果仍然遇到问题：

1. 检查 Lovable 平台的构建日志，查看具体错误信息
2. 确认环境变量名称拼写正确（区分大小写）
3. 确认环境变量值没有多余的空格或引号
4. 联系 Lovable 平台支持团队

