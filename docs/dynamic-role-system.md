# 动态角色系统使用说明

## 🎯 系统概述

动态角色系统解决了项目分配功能与系统角色不同步的问题。现在当您在系统中增加新角色时，项目分配功能会**自动同步**支持新角色，无需手动修改代码。

## ✨ 主要特性

### 1. 自动角色同步
- ✅ 项目分配功能自动支持所有系统角色
- ✅ 新增角色时无需修改项目分配代码
- ✅ 角色权限配置自动生成

### 2. 动态权限映射
- ✅ 根据角色类型自动分配项目权限
- ✅ 支持自定义权限配置
- ✅ 权限统计实时更新

### 3. 向后兼容
- ✅ 现有数据自动迁移
- ✅ 保持API接口兼容性
- ✅ 渐进式升级支持

## 🔧 技术实现

### 核心组件

1. **DynamicRoleService** (`src/services/DynamicRoleService.ts`)
   - 动态生成项目角色权限映射
   - 提供角色管理工具方法
   - 自动同步系统角色配置

2. **ProjectAssignmentService** (`src/services/ProjectAssignmentService.ts`)
   - 使用动态角色权限映射
   - 支持所有系统角色
   - 自动权限计算

3. **ProjectAssignmentManager** (`src/components/ProjectAssignmentManager.tsx`)
   - 动态角色选择界面
   - 自动角色显示和颜色
   - 实时权限统计

### 权限配置逻辑

```typescript
// 自动根据角色类型分配权限
switch (role) {
  case 'admin':     // 管理员：最高权限
  case 'finance':   // 财务：财务数据权限
  case 'business':  // 业务：业务管理权限
  case 'operator':  // 操作员：基础操作权限
  case 'partner':   // 合作方：查看权限
  case 'viewer':    // 查看者：只读权限
  default:          // 新角色：默认权限
}
```

## 🚀 使用方法

### 1. 运行动态数据库更新

```bash
# 使用动态角色更新脚本
psql -d your_database -f scripts/dynamic_role_database_update.sql
```

### 2. 验证动态角色功能

```bash
# 运行测试脚本
psql -d your_database -f scripts/test_dynamic_roles.sql
```

### 3. 测试新增角色

假设您要新增一个 `auditor`（审计员）角色：

1. **在系统配置中添加角色**：
   ```typescript
   // src/config/permissions.ts
   export const ROLES: Record<AppRole, RoleDefinition> = {
     // ... 现有角色
     auditor: {
       label: '审计员',
       color: 'bg-orange-500',
       description: '负责审计和合规检查'
     }
   };
   ```

2. **项目分配功能自动支持**：
   - 无需修改项目分配代码
   - 自动生成审计员的项目权限配置
   - 界面自动显示新角色选项

3. **验证功能**：
   ```sql
   -- 检查新角色是否被支持
   SELECT role, COUNT(*) FROM public.user_projects GROUP BY role;
   ```

## 📊 角色权限配置

| 角色 | 项目权限 | 查看 | 编辑 | 删除 | 说明 |
|------|----------|------|------|------|------|
| admin | 8项 | ✅ | ✅ | ✅ | 完全管理权限 |
| finance | 5项 | ✅ | ✅ | ❌ | 财务数据权限 |
| business | 6项 | ✅ | ✅ | ❌ | 业务管理权限 |
| operator | 4项 | ✅ | ✅ | ❌ | 基础操作权限 |
| partner | 4项 | ✅ | ❌ | ❌ | 查看权限 |
| viewer | 5项 | ✅ | ❌ | ❌ | 只读权限 |

## 🔄 新增角色流程

### 步骤1：添加系统角色
```typescript
// src/config/permissions.ts
export const ROLES = {
  // ... 现有角色
  new_role: {
    label: '新角色',
    color: 'bg-indigo-500',
    description: '新角色描述'
  }
};
```

### 步骤2：配置角色权限（可选）
```typescript
// src/services/DynamicRoleService.ts
private static getDefaultProjectPermissions(role: string) {
  switch (role) {
    // ... 现有角色
    case 'new_role':
      return {
        additionalPermissions: ['project_access', 'project.view_assigned'],
        can_view: true,
        can_edit: false,
        can_delete: false
      };
  }
}
```

### 步骤3：验证功能
- 项目分配界面自动显示新角色
- 权限统计正确计算
- 数据库操作正常

## ⚠️ 注意事项

1. **角色命名**：新增角色时请使用英文小写，避免特殊字符
2. **权限配置**：建议为新角色配置合适的默认权限
3. **数据迁移**：现有用户的项目分配会自动使用默认角色
4. **测试验证**：新增角色后请运行测试脚本验证功能

## 🐛 故障排除

### 问题1：新角色不显示
**解决方案**：
```bash
# 检查角色配置
psql -d your_database -c "SELECT DISTINCT role FROM public.profiles;"

# 重启应用
npm run dev
```

### 问题2：权限计算错误
**解决方案**：
```bash
# 运行测试脚本
psql -d your_database -f scripts/test_dynamic_roles.sql

# 检查权限映射
SELECT role, COUNT(*) FROM public.user_projects GROUP BY role;
```

### 问题3：数据库更新失败
**解决方案**：
```bash
# 检查表结构
psql -d your_database -c "\d public.user_projects"

# 手动添加列
ALTER TABLE public.user_projects ADD COLUMN IF NOT EXISTS role text DEFAULT 'operator';
```

## 📈 性能优化

1. **缓存角色配置**：角色配置在应用启动时生成，避免重复计算
2. **索引优化**：为 `role` 列创建索引，提高查询性能
3. **批量操作**：支持批量角色分配，减少数据库操作

## 🔮 未来规划

1. **角色模板**：支持自定义角色权限模板
2. **权限继承**：支持角色权限继承关系
3. **动态配置**：支持运行时修改角色权限配置
4. **审计日志**：记录角色权限变更历史

---

通过动态角色系统，您的项目分配功能现在完全支持系统角色的动态扩展，无需担心代码同步问题！
