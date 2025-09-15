# 增加新角色完整指南

## 📋 增加新角色的步骤

### 1. 修改类型定义
在 `src/types/permission.ts` 中更新 `AppRole` 类型：

```typescript
// 原来的定义
export type AppRole = 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer';

// 增加新角色后（例如增加 'manager'）
export type AppRole = 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer' | 'manager';
```

### 2. 修改角色配置
在 `src/config/permissions.ts` 中添加新角色定义：

```typescript
export const ROLES: Record<AppRole, RoleDefinition> = {
  // ... 现有角色
  manager: {
    label: '项目经理',
    color: 'bg-indigo-500',
    description: '负责项目管理，包括项目规划、进度跟踪等'
  }
};
```

### 3. 添加角色权限模板
在 `DEFAULT_ROLE_PERMISSIONS` 中添加新角色的权限：

```typescript
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, {
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}> = {
  // ... 现有角色
  manager: {
    menu_permissions: [
      'dashboard', 'dashboard.project',
      'maintenance', 'maintenance.projects',
      'business', 'business.entry',
      'contracts', 'contracts.list', 'contracts.create', 'contracts.edit'
    ],
    function_permissions: [
      'data', 'data.create', 'data.edit', 'data.export',
      'project_management', 'project.view_all', 'project.manage'
    ],
    project_permissions: [
      'project_access', 'project.view_all', 'project.manage',
      'project_data', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    data_permissions: [
      'data_scope', 'data.team',
      'data_operations', 'data.create', 'data.edit', 'data.export'
    ]
  }
};
```

### 4. 更新数据库枚举类型
运行 SQL 脚本添加新角色到数据库：

```sql
-- 添加新角色到 app_role 枚举类型
ALTER TYPE app_role ADD VALUE 'manager';
```

### 5. 创建数据库迁移脚本
创建新的迁移文件 `supabase/migrations/YYYYMMDD_add_manager_role.sql`：

```sql
-- 添加 manager 角色
ALTER TYPE app_role ADD VALUE 'manager';

-- 为新角色创建默认权限模板
INSERT INTO public.role_permission_templates (
    role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions,
    created_at,
    updated_at
) VALUES (
    'manager',
    ARRAY['dashboard', 'dashboard.project', 'maintenance', 'maintenance.projects', 'business', 'business.entry', 'contracts', 'contracts.list', 'contracts.create', 'contracts.edit'],
    ARRAY['data', 'data.create', 'data.edit', 'data.export', 'project_management', 'project.view_all', 'project.manage'],
    ARRAY['project_access', 'project.view_all', 'project.manage', 'project_data', 'project_data.view_operational', 'project_data.edit_operational'],
    ARRAY['data_scope', 'data.team', 'data_operations', 'data.create', 'data.edit', 'data.export'],
    NOW(),
    NOW()
);
```

### 6. 更新动态角色服务
`DynamicRoleService` 会自动同步新角色，无需手动修改。

### 7. 测试新角色
创建测试用户验证新角色：

```sql
-- 创建测试用户
INSERT INTO public.profiles (
    id,
    email,
    role,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'manager@example.com',
    'manager',
    NOW(),
    NOW()
);
```

## ✅ 验证步骤

1. **检查类型定义** - TypeScript 编译无错误
2. **检查角色配置** - 新角色出现在角色选择器中
3. **检查数据库** - 新角色在枚举类型中
4. **检查权限模板** - 新角色有默认权限
5. **测试功能** - 新角色用户可以正常使用系统

## 🚀 自动化脚本

运行以下脚本自动完成数据库更新：

```bash
# 1. 添加新角色到枚举类型
psql -d your_database -c "ALTER TYPE app_role ADD VALUE 'manager';"

# 2. 创建权限模板
psql -d your_database -f scripts/add_manager_role_template.sql

# 3. 验证结果
psql -d your_database -f scripts/verify_new_role.sql
```

## 📝 注意事项

1. **向后兼容** - 新角色不会影响现有用户
2. **权限设计** - 仔细设计新角色的权限范围
3. **测试充分** - 确保新角色功能正常
4. **文档更新** - 更新相关文档和说明

这样您就可以轻松地增加新角色了！
