# MD5 登录错误修复与部署指南

## 🔴 问题

错误信息：
```
登录失败 [401]: {"code":"InvalidCredentials","message":"Invalid Password"}
```

## ✅ 已修复

已将 MD5 实现从 `esm.sh/md5@2.3.0` 改为 `crypto-js@4.2.0`，这个库在 Deno 中更稳定。

## 🚀 部署方法

### 方法1：使用 Supabase CLI（推荐）

```bash
# 1. 确保已链接项目
supabase link --project-ref mnwzvtvyauyxwowjjsmf

# 2. 部署所有函数
supabase functions deploy get-tracking-token --no-verify-jwt
supabase functions deploy add-vehicle --no-verify-jwt
supabase functions deploy vehicle-tracking --no-verify-jwt
supabase functions deploy sync-vehicle-tracking-ids --no-verify-jwt
supabase functions deploy sync-vehicle --no-verify-jwt
```

### 方法2：使用 Supabase Dashboard

如果 CLI 部署有问题，可以通过 Web 界面部署：

1. **访问 Dashboard**：https://app.supabase.com
2. **进入 Edge Functions**：选择项目 → Edge Functions
3. **逐个更新函数**：
   - 点击函数名（如 `get-tracking-token`）
   - 复制本地文件内容：`supabase/functions/get-tracking-token/index.ts`
   - 粘贴到编辑器
   - 点击 **Deploy**

**注意**：Dashboard 会自动处理 `_shared` 目录的导入。

## 🔍 验证修复

部署后，检查日志应该看到：

```
✅ [ADD] 登录成功! Token: ...
```

而不是：

```
❌ [ADD] 登录异常: NotSupportedError: Unrecognized algorithm name
```

或

```
❌ 登录失败 [401]: {"code":"InvalidCredentials","message":"Invalid Password"}
```

## 📋 需要部署的函数

1. ✅ `get-tracking-token` - Token 获取服务
2. ✅ `add-vehicle` - 添加车辆
3. ✅ `vehicle-tracking` - 查询车辆轨迹
4. ✅ `sync-vehicle-tracking-ids` - 同步车辆ID映射
5. ✅ `sync-vehicle` - 同步车辆

## ⚠️ 如果仍然失败

如果部署后仍然出现 `Invalid Password` 错误，可能原因：

1. **密码已更改**：第三方平台的密码可能已更改
2. **MD5 哈希不正确**：虽然已修复，但可能需要验证
3. **网络问题**：第三方平台可能暂时不可用

### 解决方案

1. **验证密码**：手动登录第三方平台确认密码是否正确
2. **检查环境变量**：确认 `PWD_ADD` 和 `PWD_QUERY` 环境变量是否正确
3. **查看详细日志**：在 Supabase Dashboard 中查看 Edge Function 日志

---

**最后更新**：2025-01-16  
**状态**：等待部署验证

