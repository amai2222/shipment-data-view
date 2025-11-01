# Supabase 后台部署 Edge Function 指南

## 🌐 使用 Supabase Dashboard 部署

### 📋 准备工作

1. **确保您有以下信息：**
   - Supabase 账号和密码
   - 项目 URL（例如：https://mnwzvtvyauyxwowjjsmf.supabase.co）
   - 项目访问权限（管理员）

2. **准备好代码文件：**
   - 打开本地文件：`supabase/functions/delete-user-v2/index.ts`
   - 准备复制全部内容

---

## 🚀 部署步骤（详细版）

### Step 1: 登录 Supabase Dashboard

1. 访问：https://app.supabase.com
2. 使用您的账号登录
3. 选择您的项目（中科物流跟踪系统）

---

### Step 2: 进入 Edge Functions 页面

1. 在左侧菜单栏找到 **"Edge Functions"**
   - 如果看不到，点击左上角的 ☰ 菜单
   - 向下滚动找到 **"Edge Functions"**

2. 点击进入 Edge Functions 管理页面

---

### Step 3: 创建新函数

有两种方式：

#### 方式 A: 创建全新函数（推荐）

1. 点击右上角 **"Create a new function"** 或 **"New Edge Function"** 按钮
2. 填写信息：
   - **Name（函数名）**: `delete-user-v2`
   - **Template（模板）**: 选择 "HTTP Request" 或 "Blank"
3. 点击 **"Create function"**

#### 方式 B: 替换现有函数

如果您想直接替换旧的 `delete-user`：
1. 找到 `delete-user` 函数
2. 点击函数名进入编辑页面
3. 直接替换代码（跳到 Step 4）

---

### Step 4: 复制代码到编辑器

1. **打开本地文件：**
   ```
   supabase/functions/delete-user-v2/index.ts
   ```

2. **选择全部代码并复制**（Ctrl+A, Ctrl+C）

3. **在 Supabase Dashboard 中：**
   - 找到代码编辑器区域
   - 清空现有代码（如果有）
   - 粘贴复制的代码（Ctrl+V）

---

### Step 5: 保存并部署

1. **检查代码：**
   - 确保代码完整
   - 特别检查开头和结尾是否完整

2. **点击右上角的 "Deploy" 或 "Save and Deploy" 按钮**

3. **等待部署：**
   - 会显示部署进度
   - 通常需要 10-30 秒
   - 看到 ✅ "Successfully deployed" 表示成功

---

### Step 6: 验证部署

#### 在 Dashboard 中验证

1. 回到 Edge Functions 列表
2. 应该看到 `delete-user-v2` 函数
3. 状态应该是 "Active" 或 "Deployed"

#### 获取函数 URL

函数部署后的 URL 格式：
```
https://你的项目ID.supabase.co/functions/v1/delete-user-v2
```

例如：
```
https://mnwzvtvyauyxwowjjsmf.supabase.co/functions/v1/delete-user-v2
```

---

## 🧪 测试新函数

### 方法 1: 在浏览器控制台测试

1. 打开您的应用前端
2. 按 F12 打开开发者工具
3. 切换到 "Console" 标签
4. 粘贴并执行以下代码：

```javascript
// 测试新函数
const { data, error } = await supabase.functions.invoke('delete-user-v2', {
  body: {
    userId: '7136e5fd-08ae-47ea-a22b-34c1a1745206',  // 替换为实际测试用户ID
    hardDelete: false  // 先用软删除测试
  }
});

console.log('结果:', data);
console.log('错误:', error);
```

### 方法 2: 在用户管理界面测试

1. 进入 用户管理 页面
2. 创建一个测试用户
3. 尝试删除该用户
4. 应该不会报错，且用户被成功删除

---

## 🔧 如果部署失败

### 常见错误及解决方法

#### 错误 1: "Invalid TypeScript"

**原因**: 代码语法错误或格式问题

**解决**:
1. 重新复制完整代码
2. 确保包含文件开头的 import 语句
3. 确保包含文件结尾的 serve() 调用

#### 错误 2: "Deployment timeout"

**原因**: 网络问题或代码太大

**解决**:
1. 刷新页面重试
2. 检查网络连接
3. 稍后再试

#### 错误 3: "Permission denied"

**原因**: 账号权限不足

**解决**:
1. 确认您是项目的 Owner 或 Admin
2. 联系项目管理员添加权限

---

## 🔄 更新前端代码

部署成功后，需要更新前端调用：

### 方式 A: 使用新函数名（推荐）

**文件**: `src/components/permissions/UserManagement.tsx`

**第 275 行，修改：**

```typescript
// 之前
const { data, error } = await supabase.functions.invoke('delete-user', {

// 改为
const { data, error } = await supabase.functions.invoke('delete-user-v2', {
```

### 方式 B: 替换旧函数

如果您在 Step 3 选择了替换旧函数，则：
- 前端代码无需修改
- 继续使用 `delete-user`

---

## 📊 部署后验证清单

- [ ] Edge Functions 列表中能看到新函数
- [ ] 函数状态显示为 "Active"
- [ ] 在浏览器控制台能成功调用
- [ ] 删除用户不再报外键错误
- [ ] auth.users 和 profiles 同时被删除
- [ ] 关联数据被转移到管理员

---

## 🆘 获取帮助

### 查看日志

在 Supabase Dashboard 中：
1. Edge Functions → 点击函数名
2. 查看 "Logs" 标签
3. 可以看到函数执行的日志

### 测试 API 端点

使用 Postman 或 curl：

```bash
curl -X POST \
  https://你的项目ID.supabase.co/functions/v1/delete-user-v2 \
  -H 'Authorization: Bearer 你的ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "测试用户ID",
    "hardDelete": false
  }'
```

---

## 📝 注意事项

1. **部署环境变量**
   - Edge Function 会自动获取以下环境变量：
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - 无需手动配置

2. **函数权限**
   - Edge Function 使用 Service Role Key
   - 拥有管理员权限
   - 可以操作所有表

3. **部署时间**
   - 首次部署：约 30-60 秒
   - 更新部署：约 10-20 秒

4. **区域设置**
   - Edge Function 会部署到全球多个区域
   - 自动选择最近的区域执行

---

## 🎉 完成！

部署成功后，您的系统将：
- ✅ 支持安全删除用户
- ✅ 自动转移关联数据
- ✅ 不会出现外键错误
- ✅ 保持 auth.users 和 profiles 同步

---

**部署时间**: 约 5 分钟  
**难度**: ⭐⭐ (简单)  
**最后更新**: 2025-11-01

