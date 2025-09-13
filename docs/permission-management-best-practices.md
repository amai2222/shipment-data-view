# 权限系统管理最佳实践

## 📋 权限检查脚本说明

### Supabase 专用脚本

#### 1. Supabase 完整权限检查和修复脚本
**文件**: `scripts/supabase-permission-check-and-fix.sql`
**用途**: 适用于 Supabase 数据库结构的全面权限检查和修复
**使用场景**: Supabase 系统初始化、权限问题排查、定期维护

#### 2. Supabase 快速权限检查脚本
**文件**: `scripts/supabase-quick-permission-check.sql`
**用途**: 适用于 Supabase 的日常快速权限检查
**使用场景**: Supabase 日常检查、问题验证

#### 3. Supabase 权限同步和角色变更处理脚本
**文件**: `scripts/supabase-permission-sync-and-role-change-handler.sql`
**用途**: 适用于 Supabase 的权限同步、角色变更触发器、权限修复
**使用场景**: Supabase 角色变更后、权限同步、问题修复

### 标准 PostgreSQL 脚本

#### 1. 完整权限检查和修复脚本
**文件**: `scripts/comprehensive-permission-check-and-fix.sql`
**用途**: 全面检查权限系统状态，修复权限继承问题，创建角色变更触发器
**使用场景**: 标准 PostgreSQL 系统初始化、权限问题排查、定期维护

#### 2. 快速权限检查脚本
**文件**: `scripts/quick-permission-check.sql`
**用途**: 日常快速检查权限系统状态
**使用场景**: 标准 PostgreSQL 日常检查、问题验证

#### 3. 权限同步和角色变更处理脚本
**文件**: `scripts/permission-sync-and-role-change-handler.sql`
**用途**: 权限同步、角色变更触发器、权限修复
**使用场景**: 标准 PostgreSQL 角色变更后、权限同步、问题修复

## 🔧 权限继承逻辑

### 权限继承规则
1. **默认行为**: 用户默认使用角色模板权限
2. **继承状态**: 当用户有特定权限时，可以选择继承或不继承角色权限
3. **角色变更**: 用户角色变更时，自动应用新角色模板权限
4. **权限清理**: 自动清理与角色模板相同的用户特定权限

### 权限状态说明
- **role_template**: 使用角色模板权限（推荐）
- **inherited**: 继承角色权限（有用户特定权限但继承角色权限）
- **custom**: 用户特定权限（不继承角色权限）

## 🚀 使用指南

### Supabase 使用指南

#### 1. Supabase 系统初始化
```sql
-- 运行 Supabase 完整权限检查和修复
\i scripts/supabase-permission-check-and-fix.sql
```

#### 2. Supabase 日常检查
```sql
-- Supabase 快速检查权限状态
\i scripts/supabase-quick-permission-check.sql
```

#### 3. Supabase 角色变更后
```sql
-- Supabase 同步权限和修复继承问题
\i scripts/supabase-permission-sync-and-role-change-handler.sql
```

#### 4. Supabase 权限问题排查
```sql
-- 检查特定用户权限
SELECT * FROM check_permission_inheritance() 
WHERE user_email = 'admin@example.com';

-- 检查特定角色权限
SELECT * FROM check_permission_inheritance() 
WHERE user_role = 'admin';
```

### 标准 PostgreSQL 使用指南

#### 1. 系统初始化
```sql
-- 运行完整权限检查和修复
\i scripts/comprehensive-permission-check-and-fix.sql
```

#### 2. 日常检查
```sql
-- 快速检查权限状态
\i scripts/quick-permission-check.sql
```

#### 3. 角色变更后
```sql
-- 同步权限和修复继承问题
\i scripts/permission-sync-and-role-change-handler.sql
```

#### 4. 权限问题排查
```sql
-- 检查特定用户权限
SELECT * FROM check_permission_inheritance() 
WHERE user_email = 'admin@example.com';

-- 检查特定角色权限
SELECT * FROM check_permission_inheritance() 
WHERE user_role = 'admin';
```

## 🔍 权限检查要点

### 1. 角色权限模板完整性
- ✅ 每个角色都有完整的权限配置
- ✅ 权限数组不为空
- ✅ 权限键值正确

### 2. 用户权限继承状态
- ✅ 大部分用户使用角色模板权限
- ✅ 有用户特定权限的用户正确设置继承状态
- ✅ 没有不必要的用户特定权限

### 3. 权限继承逻辑
- ✅ 角色变更时自动应用新模板权限
- ✅ 权限变更有审计日志
- ✅ 权限状态显示正确

## ⚠️ 常见问题

### 1. 权限显示为"仅角色"
**原因**: 权限状态判断逻辑错误
**解决**: 修复 `PermissionVisualizer.tsx` 中的权限状态判断

### 2. 角色变更后权限未更新
**原因**: 缺少角色变更触发器
**解决**: 运行权限同步脚本创建触发器

### 3. 用户权限不继承角色权限
**原因**: 用户特定权限配置错误
**解决**: 运行权限修复脚本清理问题权限

## 📊 权限统计

### 权限分布
- **使用角色模板权限**: 大部分用户（推荐）
- **继承角色权限**: 少数用户（有特殊需求）
- **用户特定权限**: 极少数用户（特殊权限需求）

### 权限类型
- **菜单权限**: 控制页面访问
- **功能权限**: 控制功能操作
- **项目权限**: 控制项目访问
- **数据权限**: 控制数据范围

## 🎯 最佳实践

### 1. 权限设计原则
- **最小权限原则**: 用户只获得必要的权限
- **角色分离**: 不同角色有明确的权限边界
- **权限继承**: 优先使用角色模板权限

### 2. 权限管理流程
1. **角色设计**: 定义角色和权限模板
2. **用户分配**: 将用户分配到合适角色
3. **权限检查**: 定期检查权限配置
4. **权限维护**: 及时修复权限问题

### 3. 权限监控
- **定期检查**: 每周检查权限状态
- **变更审计**: 记录所有权限变更
- **问题修复**: 及时修复权限问题

## 🔧 维护命令

### 权限同步
```sql
SELECT sync_user_permissions_with_role_template();
```

### 权限修复
```sql
SELECT fix_permission_inheritance();
```

### 权限检查
```sql
SELECT * FROM check_permission_inheritance();
```

## 📝 注意事项

### Supabase 特定注意事项

1. **表结构差异**: Supabase 使用 `auth.users` 和 `public.profiles` 表，不是标准的 `public.users` 表
2. **RLS 策略**: Supabase 有行级安全策略，确保脚本在正确的安全上下文中运行
3. **触发器**: Supabase 触发器在 `public.profiles` 表上，不是 `public.users` 表
4. **权限检查**: 使用 Supabase 专用脚本检查权限状态
5. **角色枚举**: Supabase 使用 `app_role` 枚举类型定义角色

### 通用注意事项

1. **备份数据**: 运行权限脚本前备份数据库
2. **测试环境**: 先在测试环境验证脚本
3. **权限验证**: 脚本执行后验证权限效果
4. **用户通知**: 权限变更后通知相关用户
5. **文档更新**: 权限变更后更新相关文档
