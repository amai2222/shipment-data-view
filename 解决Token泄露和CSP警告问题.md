# 解决JWT Token泄露和CSP警告问题

## 🔒 问题1：JWT Token泄露

### ⚠️ 严重程度
**中等** - Token已在聊天记录中暴露

### ✅ 立即解决方案（2分钟）

#### 步骤1：退出登录
1. 打开系统
2. 点击右上角的用户菜单或头像
3. 点击**"退出登录"**

#### 步骤2：重新登录
1. 在登录页面输入账号密码
2. 点击登录
3. 完成！新Token已生成，旧Token失效

### 📝 技术说明
- JWT Token有效期：1小时
- 退出登录后，旧Token立即失效
- 重新登录会生成新的Token
- 新Token与旧Token完全不同

### ✅ 验证Token已更换
1. 按F12打开控制台
2. 运行：`localStorage.getItem('sb-mnwzvtvyauyxwowjjsmf-auth-token')`
3. 查看Token是否与之前不同

---

## 🛡️ 问题2：CSP (内容安全策略) 警告

### ⚠️ 严重程度
**低** - 只是警告，不影响功能

### 问题详情

```
Refused to execute inline script because it violates the following 
Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval'..."
```

**来源**：
- 文件：`tab.js:1`
- 扩展：`chrome-extension://3ee53c03-1bf9-4e0d-bb74-39dec0054fca/`

**原因**：
- 这是**Chrome浏览器扩展**引起的警告
- 不是您的应用程序的问题
- 某个已安装的扩展尝试执行内联脚本

---

## ✅ 解决方案（3选1）

### 方案1：忽略警告（推荐）⭐⭐⭐

**适用于**：开发环境  
**理由**：
- ✅ 这个警告不影响任何功能
- ✅ 来自浏览器扩展，非应用问题
- ✅ 不会影响用户使用

**操作**：无需任何操作

---

### 方案2：禁用Chrome扩展 ⭐⭐

**适用于**：想要干净的控制台日志

#### 步骤：
1. 在Chrome地址栏输入：`chrome://extensions/`
2. 找到扩展ID：`3ee53c03-1bf9-4e0d-bb74-39dec0054fca`
3. 关闭该扩展的开关
4. 刷新页面

---

### 方案3：配置应用的CSP策略 ⭐

**适用于**：生产环境部署

#### 修改index.html（添加CSP meta标签）

在 `index.html` 的 `<head>` 标签中添加：

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mnwzvtvyauyxwowjjsmf.supabase.co; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self' https://mnwzvtvyauyxwowjjsmf.supabase.co wss://mnwzvtvyauyxwowjjsmf.supabase.co; 
               font-src 'self' data:;">
```

**注意**：此方案仅用于生产环境，开发环境不需要。

---

## 🎯 推荐操作

### 立即执行：
✅ **重新登录** - 解决Token泄露问题（必须）

### 可选操作：
⭐ **忽略CSP警告** - 不影响功能（推荐）  
或  
⭐ **禁用相关扩展** - 如果您想要干净的控制台

---

## 📋 快速检查清单

### Token安全检查
- [ ] 已退出登录
- [ ] 已重新登录
- [ ] 验证新Token与旧Token不同
- [ ] 确认系统功能正常

### CSP警告处理
- [ ] 确认警告来自浏览器扩展（不是应用）
- [ ] 确认应用功能正常运行
- [ ] 决定是忽略还是禁用扩展

---

## 🔐 预防措施

### 开发时
1. **不要截图包含控制台的Token信息**
2. 使用控制台过滤器隐藏敏感日志
3. 定期清理localStorage

### 分享信息时
1. 截图前清空控制台（Ctrl+L）
2. 或使用浏览器隐身模式测试
3. 截图时避开Token、密码等敏感信息

### 生产环境
1. 配置适当的CSP策略
2. 使用HTTPS
3. 设置合理的Token过期时间
4. 启用日志脱敏

---

## ✅ 总结

### 必须执行
1. ✅ **退出并重新登录** - 解决Token泄露

### 可选操作
2. ⭐ **忽略CSP警告** - 不影响功能（推荐）

**5分钟内即可完成，应用功能不受影响！** 🚀

