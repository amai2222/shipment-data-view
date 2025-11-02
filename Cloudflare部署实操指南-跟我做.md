# Cloudflare Pages 部署实操指南 - 跟我做 🚀

## 📋 开始前准备（1分钟）

### ✅ 确认你已经有：
- [ ] GitHub 账号（已有项目代码）
- [ ] 项目已推送到 GitHub
- [ ] Supabase 环境变量（URL 和 ANON_KEY）

### 📝 需要准备的信息：
```
1. Supabase URL: https://你的项目.supabase.co
2. Supabase Anon Key: eyJhbG...（很长的一串）

在哪里找？
→ 登录 Supabase Dashboard
→ 选择你的项目
→ 点击左侧 "Settings" → "API"
→ 复制 "Project URL" 和 "anon public" key
```

---

## 🎯 第一步：注册 Cloudflare（2分钟）

### 操作步骤：

1. **打开浏览器，访问**：
   ```
   https://pages.cloudflare.com
   ```

2. **点击右上角 "Sign up"**（如果已有账号，点击 "Log in"）

3. **填写注册信息**：
   - 邮箱：你的邮箱
   - 密码：设置一个强密码
   - 点击 "Sign up"

4. **验证邮箱**：
   - 打开邮箱
   - 找到 Cloudflare 的验证邮件
   - 点击验证链接

5. **完成！** 你会看到 Cloudflare 的主页面

---

## 🔗 第二步：连接 GitHub（3分钟）

### 操作步骤：

1. **在 Cloudflare Pages 主页面，点击**：
   ```
   "Create a project" 按钮（蓝色大按钮）
   ```

2. **选择连接方式**：
   ```
   点击 "Connect to Git"
   ```

3. **选择 GitHub**：
   ```
   看到三个选项：GitHub / GitLab / Direct Upload
   点击 "GitHub"
   ```

4. **授权 Cloudflare**：
   - 会跳转到 GitHub 授权页面
   - 点击 "Authorize Cloudflare Pages"
   - 可能需要输入 GitHub 密码确认

5. **选择仓库访问权限**（推荐）：
   ```
   选项 1：All repositories（所有仓库）
   选项 2：Only select repositories（推荐）
   
   如果选择选项 2：
   → 点击 "Select repositories"
   → 搜索 "shipment-data-view"（你的项目名）
   → 勾选
   → 点击 "Install & Authorize"
   ```

6. **完成！** 你会回到 Cloudflare，看到你的仓库列表

---

## ⚙️ 第三步：配置项目（5分钟）

### 操作步骤：

1. **选择仓库**：
   ```
   在仓库列表中，找到 "shipment-data-view"
   点击旁边的 "Begin setup" 按钮
   ```

2. **填写项目设置**（重要！）：

   **📌 项目名称**（Project name）：
   ```
   shipment-data-view
   
   （或者你喜欢的名字，这将成为你的域名：
   https://shipment-data-view.pages.dev）
   ```

   **📌 生产分支**（Production branch）：
   ```
   main
   
   （确保选择你的主分支，可能是 main 或 master）
   ```

   **📌 Framework preset**：
   ```
   选择：None
   
   （Cloudflare 会自动检测 Vite，但选 None 更保险）
   ```

3. **构建设置**（Build settings）：

   **📌 Build command**：
   ```
   npm run build
   ```

   **📌 Build output directory**：
   ```
   dist
   ```

   **📌 Root directory**（保持默认）：
   ```
   /
   ```

   **📌 Node version**（点击展开 "Environment variables"）：
   ```
   不需要设置，Cloudflare 会自动使用 Node 18
   ```

---

## 🔐 第四步：添加环境变量（最关键！）

### 操作步骤：

1. **展开环境变量设置**：
   ```
   在构建设置下方，找到 "Environment variables (advanced)"
   点击展开
   ```

2. **添加第一个变量**：
   ```
   Variable name: VITE_SUPABASE_URL
   Value: https://你的项目.supabase.co
   
   点击 "Add variable"
   ```

3. **添加第二个变量**：
   ```
   Variable name: VITE_SUPABASE_ANON_KEY
   Value: eyJhbG...（你的完整 anon key）
   
   点击 "Add variable"
   ```

4. **添加第三个变量**（禁用 PWA）：
   ```
   Variable name: VITE_ENABLE_PWA
   Value: false
   
   点击 "Add variable"
   ```

5. **重要提示**：
   ```
   确保每个变量都选择了：
   ✅ Production
   ✅ Preview
   
   （默认已选中，如果没有就勾选）
   ```

### 你应该看到 3 个变量：
```
1. VITE_SUPABASE_URL        = https://...
2. VITE_SUPABASE_ANON_KEY   = eyJhbG...
3. VITE_ENABLE_PWA          = false
```

---

## 🚀 第五步：点击部署（2分钟）

### 操作步骤：

1. **最后检查**：
   - ✅ 项目名称正确
   - ✅ 生产分支是 main
   - ✅ Build command 是 `npm run build`
   - ✅ Build output 是 `dist`
   - ✅ 3 个环境变量都已添加

2. **开始部署**：
   ```
   滚动到页面底部
   点击 "Save and Deploy" 按钮（绿色大按钮）
   ```

3. **等待构建**（2-3分钟）：
   ```
   你会看到：
   - "Initializing build environment"
   - "Cloning repository"
   - "Installing dependencies"
   - "Building application"
   - "Deploying to Cloudflare's global network"
   ```

4. **构建成功！** 🎉
   ```
   看到绿色的 "Success" 标志
   你的网站地址：https://shipment-data-view.pages.dev
   ```

---

## ✅ 第六步：测试网站（2分钟）

### 操作步骤：

1. **点击 "Visit site" 按钮**

2. **测试登录功能**：
   ```
   打开网站
   → 应该看到登录页面
   → 尝试登录
   → 检查是否能正常访问
   ```

3. **检查企业微信登录**：
   ```
   如果有企业微信扫码登录
   → 测试是否正常
   ```

4. **检查控制台**：
   ```
   按 F12 打开开发者工具
   → 查看 Console 标签
   → 不应该有红色错误
   ```

---

## 🎯 第七步：配置预览部署（可选）

### 预览部署说明：

**自动功能**（无需配置）：
```
✅ 每次推送到 GitHub，Cloudflare 会自动构建
✅ 每个分支都有独立的预览链接
✅ 每个 Pull Request 都有预览链接
```

**查看预览**：
```
1. 在 Cloudflare Pages 项目页面
2. 点击 "View builds"
3. 看到所有部署历史
4. 点击任意构建查看详情
```

---

## 🌐 第八步：配置自定义域名（可选）

### 如果你有自己的域名：

1. **在项目设置中**：
   ```
   点击项目名称
   → 点击 "Custom domains" 标签
   → 点击 "Set up a custom domain"
   ```

2. **输入域名**：
   ```
   例如：www.your-domain.com
   点击 "Continue"
   ```

3. **配置 DNS**：
   
   **如果域名在 Cloudflare**：
   ```
   ✅ 自动配置，无需操作
   ```

   **如果域名在其他地方**：
   ```
   去你的域名注册商（如阿里云、腾讯云）
   添加 CNAME 记录：
   
   类型: CNAME
   名称: www
   值: shipment-data-view.pages.dev
   TTL: 自动或 3600
   ```

4. **等待生效**：
   ```
   DNS 生效时间：几分钟到几小时
   Cloudflare 会自动配置 HTTPS
   ```

---

## 📊 第九步：启用分析（可选）

### 启用免费的 Web Analytics：

1. **在 Cloudflare 主页面**：
   ```
   左侧菜单 → 找到 "Analytics & Logs"
   → 点击 "Web Analytics"
   ```

2. **添加网站**：
   ```
   点击 "Add a site"
   选择你的 Pages 项目
   点击 "Enable"
   ```

3. **查看数据**：
   ```
   等待几小时后
   回到 Web Analytics
   查看访问量、访客数、页面加载时间等
   ```

---

## 🔄 后续使用：自动部署

### 每次更新代码：

```bash
# 在本地修改代码
# ...

# 提交更改
git add .
git commit -m "更新功能"

# 推送到 GitHub
git push origin main

# ✅ Cloudflare 会自动检测
# ✅ 自动构建
# ✅ 自动部署
# ✅ 2-3 分钟后更新生效
```

### 查看部署状态：

```
1. 打开 Cloudflare Pages 项目页面
2. 看到最新的构建状态
3. 点击查看详细日志
```

---

## ❌ 常见问题排查

### 问题 1：构建失败

**错误信息**：`Build failed`

**解决方法**：
```
1. 在 Cloudflare 中点击失败的构建
2. 查看详细日志
3. 常见原因：
   - 环境变量未设置
   - Build command 错误
   - 依赖安装失败

检查：
→ 环境变量是否都添加了
→ Build command 是否是 npm run build
→ Build output 是否是 dist
```

### 问题 2：页面空白

**现象**：网站打开是白色空白页

**解决方法**：
```
1. 按 F12 打开浏览器控制台
2. 查看错误信息
3. 常见原因：
   - 环境变量未生效
   - API 请求失败

解决：
→ 在 Cloudflare 重新保存环境变量
→ 触发重新部署（推送一个空 commit）
```

### 问题 3：企业微信登录失败

**现象**：扫码后无法登录

**解决方法**：
```
检查：
→ Supabase 中的回调 URL 是否包含新域名
→ 企业微信后台配置的可信域名

添加回调 URL：
1. 登录 Supabase Dashboard
2. Authentication → URL Configuration
3. 添加：https://shipment-data-view.pages.dev
```

### 问题 4：如何回滚到之前的版本

**操作步骤**：
```
1. 在 Cloudflare Pages 项目页面
2. 点击 "View builds"
3. 找到之前成功的构建
4. 点击右侧的 "..." 菜单
5. 选择 "Rollback to this deployment"
6. 确认回滚
```

---

## 📝 快速检查清单

部署前检查：
- [ ] 代码已推送到 GitHub
- [ ] Supabase 环境变量已准备好
- [ ] 已注册 Cloudflare 账号

配置检查：
- [ ] 项目名称已设置
- [ ] 生产分支选择 main
- [ ] Build command: `npm run build`
- [ ] Build output: `dist`
- [ ] 环境变量已添加（3个）

部署后检查：
- [ ] 构建成功（绿色 Success）
- [ ] 网站能正常打开
- [ ] 登录功能正常
- [ ] 控制台无错误

---

## 🎉 恭喜！部署完成！

### 你现在拥有：

✅ **免费网站托管**（无限带宽）
✅ **自动部署**（推送代码就更新）
✅ **全球 CDN**（加速访问）
✅ **预览部署**（每个分支独立预览）
✅ **HTTPS 加密**（自动配置）

### 你的网站地址：
```
https://shipment-data-view.pages.dev
```

### 分享给你的团队吧！🎊

---

## 📞 需要帮助？

如果遇到任何问题：

1. **查看构建日志**：
   - Cloudflare Pages → 你的项目 → View builds → 点击构建 → 查看日志

2. **检查环境变量**：
   - Settings → Environment variables → 确认都已添加

3. **重新部署**：
   ```bash
   git commit --allow-empty -m "触发重新部署"
   git push origin main
   ```

4. **告诉我具体的错误信息**：
   - 截图错误页面
   - 复制控制台错误
   - 我会帮你解决！

---

**现在，跟着上面的步骤，一步一步来！** 😊

**预计总时间：15 分钟** ⏱️

