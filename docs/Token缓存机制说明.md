# Token 缓存机制说明

## 📋 概述

实现了基于数据库的 Token 缓存机制，避免每次请求都执行登录操作，提高系统性能和响应速度。

## 🏗️ 架构设计

### 三层缓存机制

```
1. 内存缓存（单次调用内）
   ↓ 失效
2. 数据库缓存（跨调用共享）
   ↓ 失效
3. 自动登录获取新 Token
```

### 工作流程

```
用户请求 → Edge Function
    ↓
调用 get-tracking-token
    ↓
1. 检查内存缓存 → 有效？返回 Token
    ↓ 无效
2. 检查数据库缓存 → 有效？返回 Token 并更新内存缓存
    ↓ 无效或不存在
3. 自动登录获取 Token
    ↓
4. 保存到数据库 + 更新内存缓存
    ↓
5. 返回 Token
```

## 📊 数据库表结构

### `tracking_token_cache` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `token_type` | TEXT | Token 类型：'add' 或 'query'（唯一） |
| `token_value` | TEXT | Token 值（Auth-Session） |
| `expires_at` | TIMESTAMPTZ | Token 过期时间 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

## ⚙️ 缓存策略

### 1. 内存缓存（单次调用内）

- **作用域**：单次 Edge Function 调用
- **有效期**：25分钟（与 Token 有效期一致）
- **用途**：避免在同一调用内重复查询数据库

### 2. 数据库缓存（跨调用共享）

- **作用域**：所有 Edge Function 调用共享
- **有效期**：25分钟（提前5分钟刷新）
- **刷新策略**：Token 过期前5分钟自动刷新

### 3. 自动登录

- **触发条件**：
  - 数据库中没有 Token
  - Token 已过期
  - Token 即将过期（5分钟内）

## 🔄 Token 获取流程

### 正常流程（Token 有效）

```
1. 检查内存缓存 → 命中 → 返回 Token（最快）
2. 检查数据库缓存 → 命中 → 返回 Token + 更新内存缓存
3. 自动登录 → 保存到数据库 + 更新内存缓存 → 返回 Token
```

### 过期处理

```
1. 检测到 Token 过期（401/403）
2. 清除内存缓存
3. 重新调用 get-tracking-token
4. 自动登录获取新 Token
5. 保存到数据库
6. 使用新 Token 重试请求
```

## 📈 性能优势

### 之前（每次登录）

- 每次请求：~1-2秒（登录时间）
- 100次请求：~100-200秒

### 现在（数据库缓存）

- 首次请求：~1-2秒（登录时间）
- 后续请求：~50-100ms（数据库查询）
- 100次请求：~1-2秒（首次）+ ~5-10秒（后续）= ~6-12秒

**性能提升**：约 **10-20倍**

## 🔍 监控和管理

### 查看 Token 状态

```sql
-- 查看所有 Token 缓存
SELECT 
    token_type,
    LEFT(token_value, 20) || '...' as token_preview,
    expires_at,
    CASE 
        WHEN expires_at > NOW() THEN '有效'
        ELSE '已过期'
    END as status,
    updated_at
FROM tracking_token_cache
ORDER BY token_type;
```

### 手动清除 Token

```sql
-- 清除所有 Token 缓存（强制重新登录）
DELETE FROM tracking_token_cache;

-- 清除特定类型的 Token
DELETE FROM tracking_token_cache WHERE token_type = 'add';
DELETE FROM tracking_token_cache WHERE token_type = 'query';
```

### 查看 Token 使用情况

```sql
-- 查看 Token 剩余有效时间
SELECT 
    token_type,
    expires_at,
    expires_at - NOW() as remaining_time,
    CASE 
        WHEN expires_at - NOW() > INTERVAL '5 minutes' THEN '有效'
        WHEN expires_at - NOW() > INTERVAL '0 minutes' THEN '即将过期'
        ELSE '已过期'
    END as status
FROM tracking_token_cache;
```

## 🛡️ 安全考虑

1. **Token 加密存储**：虽然 Token 存储在数据库中，但建议：
   - 使用 Supabase 的 RLS 策略限制访问
   - 只有服务角色可以写入
   - 定期清理过期 Token

2. **自动清理**：可以创建定时任务清理过期 Token

```sql
-- 清理过期 Token（可以设置为定时任务）
DELETE FROM tracking_token_cache 
WHERE expires_at < NOW() - INTERVAL '1 hour';
```

## 🔧 配置说明

### 缓存有效期

- **Token 有效期**：25分钟（由第三方平台决定）
- **提前刷新时间**：5分钟（确保 Token 始终有效）
- **实际缓存时间**：20分钟（25分钟 - 5分钟缓冲）

### 环境变量

无需额外配置，使用 Supabase 默认环境变量：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 📝 使用示例

### 自动获取 Token（无需手动操作）

所有 Edge Functions 自动使用缓存机制：

```typescript
// add-vehicle, sync-vehicle, vehicle-tracking 等函数
// 都会自动调用 get-tracking-token
// get-tracking-token 会自动：
// 1. 检查数据库缓存
// 2. 如果有效，直接返回
// 3. 如果无效，自动登录并更新缓存
```

### 手动刷新 Token（前端界面）

用户可以通过前端界面手动刷新 Token：

```typescript
// 点击"刷新添加Token"或"刷新查询Token"按钮
// 会调用 get-tracking-token Edge Function
// 强制重新登录并更新数据库缓存
```

## 🐛 故障排除

### 问题1：Token 一直过期

**可能原因**：
- 数据库中的 Token 已过期但未清理
- 第三方平台 Token 有效期变短

**解决方案**：
```sql
-- 手动清除过期 Token
DELETE FROM tracking_token_cache WHERE expires_at < NOW();
```

### 问题2：缓存未生效

**可能原因**：
- 数据库表未创建
- RLS 策略阻止访问

**解决方案**：
1. 检查迁移文件是否已执行
2. 检查 RLS 策略是否正确配置

### 问题3：性能未提升

**可能原因**：
- 数据库查询慢
- 网络延迟

**解决方案**：
1. 检查数据库索引是否创建
2. 检查网络连接

## ✅ 优势总结

1. **性能提升**：减少 90%+ 的登录操作
2. **自动管理**：无需手动维护 Token
3. **跨调用共享**：所有 Edge Functions 共享 Token
4. **自动刷新**：Token 过期前自动刷新
5. **易于监控**：可以通过数据库查看 Token 状态

---

**最后更新**：2025-01-16  
**维护者**：开发团队

