# 项目分配功能说明

## 功能概述

项目分配功能允许管理员为用户分配项目访问权限。默认情况下，所有用户都具有所有项目的访问权限，管理员可以通过取消分配来限制用户访问特定项目。

## 主要特性

### 1. 默认权限策略
- **默认开放**：所有用户默认具有所有项目的访问权限
- **明确限制**：只有在 `user_projects` 表中有明确限制时才限制访问
- **自动分配**：新用户和新项目会自动分配给所有用户

### 2. 项目角色
- **管理员 (admin)**：项目管理员权限
- **成员 (member)**：普通项目成员权限
- **查看者 (viewer)**：只读项目权限

### 3. 管理功能
- **单个分配**：为单个用户分配/移除项目权限
- **批量操作**：批量分配/移除多个项目权限
- **搜索过滤**：按项目名称、负责人、地址搜索
- **状态过滤**：按项目状态（进行中/已结束）过滤

## 技术实现

### 数据库结构

#### user_projects 表
```sql
CREATE TABLE public.user_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role text DEFAULT 'member', -- member, admin, viewer
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  UNIQUE(user_id, project_id)
);
```

#### 自动分配触发器
- **新用户触发器**：当创建新用户时，自动分配所有现有项目
- **新项目触发器**：当创建新项目时，自动分配给所有现有用户

### 服务层

#### ProjectAssignmentService
提供项目分配的核心服务功能：

```typescript
// 获取用户项目分配
static async getUserProjectAssignments(userId: string): Promise<UserProjectAssignment[]>

// 分配项目给用户
static async assignProjectToUser(userId: string, projectId: string, role: string): Promise<void>

// 移除用户项目分配
static async removeProjectFromUser(userId: string, projectId: string): Promise<void>

// 批量操作
static async batchAssignProjectsToUser(userId: string, projectIds: string[], role: string): Promise<void>
static async batchRemoveProjectsFromUser(userId: string, projectIds: string[]): Promise<void>

// 权限检查
static async hasProjectAccess(userId: string, projectId: string): Promise<boolean>
```

### 组件层

#### ProjectAssignmentManager
项目分配管理组件，提供完整的项目分配管理界面：

- **统计概览**：显示总项目数、已分配数、进行中项目数等
- **搜索过滤**：支持按项目名称、负责人、地址搜索
- **批量操作**：支持批量分配和移除项目权限
- **状态管理**：显示项目状态和分配状态

#### UserManagement 集成
在用户管理组件中集成了项目分配功能：

- **项目分配按钮**：每个用户都有"项目分配"按钮
- **弹窗管理**：通过对话框管理用户的项目分配
- **实时更新**：分配变更后实时更新用户列表

## 使用说明

### 1. 访问项目分配
1. 进入用户管理页面
2. 找到目标用户
3. 点击"项目分配"按钮

### 2. 分配项目权限
1. 在项目列表中勾选要分配的项目
2. 选择项目角色（成员/管理员/查看者）
3. 点击"确认分配"

### 3. 移除项目权限
1. 在项目列表中取消勾选要移除的项目
2. 系统会自动移除该项目的分配

### 4. 批量操作
1. 选择多个项目（使用复选框）
2. 点击"批量分配"或"批量移除"
3. 确认操作

## 权限说明

### 默认权限策略
- 所有用户默认具有所有项目的访问权限
- 只有在 `user_projects` 表中有明确限制时才限制访问
- 新用户和新项目会自动分配给所有用户

### 项目角色权限
- **管理员**：可以管理项目，包括分配其他用户
- **成员**：可以访问项目数据和功能
- **查看者**：只能查看项目数据，不能修改

### 系统权限
- 只有系统管理员可以管理项目分配
- 普通用户只能查看自己的项目分配情况

## 配置和维护

### 初始化设置
运行 `scripts/setup_default_project_permissions.sql` 脚本来设置默认权限：

```sql
-- 为所有现有用户分配所有项目权限
-- 创建自动分配触发器
-- 设置权限检查函数
```

### 维护操作
- **重置权限**：删除 `user_projects` 表中的记录来恢复默认权限
- **批量调整**：通过管理界面批量调整用户的项目权限
- **权限审计**：通过 `permission_audit_logs` 表查看权限变更历史

## 注意事项

1. **默认权限**：系统采用"默认开放"策略，确保用户不会因为权限问题无法访问项目
2. **自动分配**：新用户和新项目会自动分配，无需手动操作
3. **权限检查**：权限检查函数默认返回 `true`，确保向后兼容
4. **数据一致性**：通过触发器确保数据一致性，避免权限遗漏
5. **审计日志**：所有权限变更都会记录在审计日志中

## 故障排除

### 常见问题
1. **用户无法访问项目**：检查 `user_projects` 表中是否有限制记录
2. **新用户没有项目权限**：检查触发器是否正常工作
3. **权限变更不生效**：检查权限检查函数是否正确

### 调试方法
1. 查看 `user_projects` 表中的分配记录
2. 检查触发器是否正常创建
3. 查看审计日志了解权限变更历史
4. 使用权限检查函数验证权限状态
