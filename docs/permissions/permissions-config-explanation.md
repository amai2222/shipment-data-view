# 权限配置文件说明

## 📋 概述

`src/config/permissions.ts` 文件中的硬编码配置**不是实际的权限数据**，而是权限系统的**元数据定义**和**初始化数据**。

## 🎯 文件中的三种配置

### 1. 权限元数据定义（用于UI显示）

#### `MENU_PERMISSIONS` 和 `FUNCTION_PERMISSIONS`

**用途**：
- 定义系统中所有可用的权限键（key）
- 提供权限的中文标签（label）和描述（description）
- 用于在权限管理UI中显示所有可选的权限选项

**特点**：
- ✅ **不是实际权限数据**，只是权限的"清单"
- ✅ 用于告诉管理员"系统中有哪些权限可以分配"
- ✅ 在 `PermissionManagement.tsx` 中用于渲染权限选择界面

**示例**：
```typescript
{
  group: '财务操作',
  key: 'finance',
  label: '财务操作',
  children: [
    { key: 'finance.pay_payment', label: '付款按钮', description: '控制"付款"按钮的显示' },
    { key: 'finance.modify_cost', label: '修改应收按钮', description: '控制"修改应收"按钮的显示' }
  ]
}
```

### 2. 默认角色权限模板（仅用于初始化）

#### `DEFAULT_ROLE_PERMISSIONS`

**用途**：
- ⚠️ **仅用于系统初始化或紧急恢复**
- 系统首次部署时，用于创建初始的角色模板
- 紧急情况下，用于重置角色模板到初始状态

**使用场景**：
1. 系统首次初始化：创建 `role_permission_templates` 表的初始数据
2. 紧急恢复：通过 `PermissionResetService.resetRoleTemplateToSystemDefault()` 重置角色模板

**⚠️ 重要**：
- ❌ **不用于日常权限检查**
- ❌ **不会覆盖用户在数据库中配置的权限**
- ✅ 所有权限检查都从数据库读取

### 3. 角色定义（用于UI显示）

#### `ROLES`

**用途**：
- 定义系统中所有可用的角色类型
- 提供角色的中文名称、颜色、描述等
- 用于在用户管理和角色管理界面中显示

## 🔄 权限系统的实际工作流程

### 权限检查流程

```
用户操作
  ↓
useUnifiedPermissions()
  ↓
useSimplePermissions()
  ↓
从数据库读取：role_permission_templates 表
  ↓
检查用户是否有权限
```

### 权限分配流程

```
管理员在权限管理界面操作
  ↓
选择权限（使用 MENU_PERMISSIONS 和 FUNCTION_PERMISSIONS 显示选项）
  ↓
保存到数据库：role_permission_templates 或 user_permissions 表
  ↓
权限生效
```

## 📊 数据库表结构

### `role_permission_templates` 表

存储角色模板的权限配置：

```sql
CREATE TABLE role_permission_templates (
  role TEXT PRIMARY KEY,
  menu_permissions TEXT[],
  function_permissions TEXT[],
  project_permissions TEXT[],
  data_permissions TEXT[]
);
```

### `user_permissions` 表

存储用户的自定义权限配置：

```sql
CREATE TABLE user_permissions (
  user_id UUID,
  menu_permissions TEXT[],
  function_permissions TEXT[],
  project_permissions TEXT[],
  data_permissions TEXT[]
);
```

## ✅ 权限系统设计原则

### 1. 数据库优先

- ✅ 所有权限检查都从数据库读取
- ✅ 所有权限分配都保存到数据库
- ✅ 用户修改的权限会永久保存

### 2. 元数据与数据分离

- ✅ 权限元数据（定义）存储在代码中（`permissions.ts`）
- ✅ 权限数据（分配）存储在数据库中（`role_permission_templates`、`user_permissions`）

### 3. 初始化与运行分离

- ✅ 初始化数据（`DEFAULT_ROLE_PERMISSIONS`）仅用于系统初始化
- ✅ 运行时的权限检查完全基于数据库

## 🎯 总结

**`src/config/permissions.ts` 文件的作用**：

1. ✅ **权限元数据定义**：告诉系统有哪些权限可用（用于UI显示）
2. ✅ **系统初始化数据**：用于首次创建角色模板
3. ❌ **不是实际权限数据**：实际的权限分配存储在数据库中

**权限检查流程**：
- 前端：`useUnifiedPermissions()` → 从数据库读取权限
- 后端：RPC函数中的 `has_function_permission()` → 从数据库检查权限

**结论**：权限系统完全基于数据库运行，硬编码配置仅用于元数据定义和系统初始化。

