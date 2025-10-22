# 视图 RLS 策略修复说明

## 🚨 问题说明

在 Supabase Dashboard 中，以下视图显示 **"Unrestricted"** 红色警告：

| 视图名称 | 状态 |
|---------|------|
| `logistics_records_view` | ⚠️ Unrestricted |
| `logistics_records_status_summary` | ⚠️ Unrestricted |
| `partners_hierarchy_view` | ⚠️ Unrestricted |

## ❓ 什么是 "Unrestricted"？

**Unrestricted** 表示该表/视图**没有启用行级安全策略（RLS - Row Level Security）**。

### 安全风险

- ❌ **任何人都可以访问这些数据**（包括未授权用户）
- ❌ **绕过应用层的权限控制**
- ❌ **可能导致数据泄露**

### 为什么会出现这个警告？

在 Supabase 中：
1. 表默认启用 RLS
2. 但视图需要**手动启用** RLS
3. 如果没有启用，就会显示 "Unrestricted" 警告

## ✅ 解决方案

我已经创建了 RLS 策略配置脚本。

### 执行方式1：使用迁移（推荐）

```bash
supabase db push
```

将会执行：`supabase/migrations/20250122_fix_view_rls_policies.sql`

### 执行方式2：快速修复

在 Supabase Dashboard SQL Editor 中执行：

```sql
-- 复制 快速修复视图RLS策略.sql 的内容
```

## 🔐 配置的安全策略

### 1. logistics_records_view

**策略名称**：`logistics_records_view_select_policy`

**规则**：
```sql
-- 管理员可以看到所有运单
public.is_admin() 
OR
-- 普通用户只能看到自己有权限的项目的运单
project_id IN (
    SELECT project_id 
    FROM public.user_projects 
    WHERE user_id = auth.uid()
)
```

### 2. logistics_records_status_summary

**策略名称**：`logistics_records_status_summary_select_policy`

**规则**：
```sql
-- 与 logistics_records_view 相同
-- 用户只能看到自己有权限的项目的统计数据
```

### 3. partners_hierarchy_view

**策略名称**：`partners_hierarchy_view_select_policy`

**规则**：
```sql
-- 所有已认证用户都可以查看货主层级
USING (true)
```

**为什么货主层级对所有人开放？**
- 货主层级用于项目配置
- 业务人员需要查看完整的货主关系
- 只有货主名称等基本信息，不涉及敏感数据

## 📊 执行后的效果

### 验证步骤

1. **执行迁移或快速修复脚本**

2. **刷新 Supabase Dashboard**

3. **检查视图状态**
   - ✅ `logistics_records_view` - 无红色警告
   - ✅ `logistics_records_status_summary` - 无红色警告
   - ✅ `partners_hierarchy_view` - 无红色警告

4. **查看策略**
   
   在 Supabase Dashboard → Table Editor → 选择视图 → Policies 标签

   应该看到每个视图都有对应的策略。

### SQL 验证

```sql
-- 查看所有视图的 RLS 状态
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'logistics_records_view',
    'logistics_records_status_summary',
    'partners_hierarchy_view'
  )
ORDER BY tablename, policyname;
```

## 🎯 安全最佳实践

### ✅ 已实现

- ✅ 所有视图启用 RLS
- ✅ 基于用户项目权限控制访问
- ✅ 管理员有完整访问权限
- ✅ 普通用户只能看到授权数据

### 📋 建议

1. **定期审查策略**
   - 确保策略与业务需求一致
   - 及时更新权限规则

2. **测试权限**
   ```sql
   -- 以普通用户身份测试
   SELECT COUNT(*) FROM logistics_records_view;
   -- 应该只返回该用户有权限的项目的运单
   ```

3. **监控访问**
   - 使用 Supabase 的日志功能
   - 监控异常访问模式

## ⚠️ 注意事项

### 迁移已有应用

如果您的应用已经在生产环境运行：

1. **先在测试环境验证**
   - 确保策略不会阻止正常访问
   - 测试所有用户角色

2. **检查应用代码**
   - 确保应用使用正确的认证
   - 所有查询都使用 `auth.uid()`

3. **通知用户**
   - 如果需要重新登录
   - 说明安全改进

### 可能的问题

**问题1**：执行后用户看不到数据

**原因**：用户没有分配到任何项目

**解决**：
```sql
-- 检查用户的项目分配
SELECT * FROM user_projects WHERE user_id = 'USER_UUID';

-- 如果没有记录，需要在用户管理中分配项目
```

**问题2**：管理员也看不到数据

**原因**：`is_admin()` 函数可能不存在或返回错误

**解决**：
```sql
-- 检查函数
SELECT * FROM pg_proc WHERE proname = 'is_admin';

-- 临时解决：修改策略使用角色判断
-- 或者检查 profiles 表的 role 字段
```

## 🚀 立即执行

### 推荐：完整迁移

```bash
cd /path/to/your/project
supabase db push
```

### 快速：手动执行

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 复制 `快速修复视图RLS策略.sql` 的内容
4. 点击 Run
5. 刷新页面，检查红色警告是否消失

---

**状态**：✅ 修复脚本已就绪  
**影响**：提升数据安全性  
**风险**：低（仅影响视图访问权限）  
**测试时间**：5分钟  
**创建时间**：2025-01-22

