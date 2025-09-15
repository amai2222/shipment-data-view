# 项目分配与权限系统集成说明

## 🎯 权限系统集成

项目分配功能现在与现有的权限系统完全集成，确保权限分配的一致性和可维护性。

## 📋 权限映射关系

### 1. **管理员 (admin)**
```typescript
// 权限系统权限
permissions: [
  'project_access',           // 项目访问基础权限
  'project.view_all',         // 查看所有项目
  'project.admin',            // 项目管理员权限
  'project_data',             // 项目数据权限
  'project_data.view_financial',    // 查看财务数据
  'project_data.edit_financial',     // 编辑财务数据
  'project_data.view_operational',   // 查看运营数据
  'project_data.edit_operational'    // 编辑运营数据
]

// 数据库权限列
can_view: true,
can_edit: true,
can_delete: true
```

### 2. **成员 (member)**
```typescript
// 权限系统权限
permissions: [
  'project_access',           // 项目访问基础权限
  'project.view_assigned',    // 查看分配项目
  'project.manage',           // 项目管理权限
  'project_data',             // 项目数据权限
  'project_data.view_operational',   // 查看运营数据
  'project_data.edit_operational'    // 编辑运营数据
]

// 数据库权限列
can_view: true,
can_edit: true,
can_delete: false
```

### 3. **查看者 (viewer)**
```typescript
// 权限系统权限
permissions: [
  'project_access',           // 项目访问基础权限
  'project.view_assigned',    // 查看分配项目
  'project_data',             // 项目数据权限
  'project_data.view_operational'    // 查看运营数据
]

// 数据库权限列
can_view: true,
can_edit: false,
can_delete: false
```

## 🔄 权限检查流程

### 1. **用户权限计算**
```typescript
// 1. 检查用户是否有项目分配记录
const assignment = await getUserProjectAssignment(userId, projectId);

// 2. 如果有分配记录，使用分配的角色权限
if (assignment) {
  return PROJECT_ROLE_PERMISSIONS[assignment.role];
}

// 3. 如果没有分配记录，检查用户角色模板
const userRole = await getUserRole(userId);
const roleTemplate = await getRoleTemplate(userRole);

// 4. 使用角色模板的项目权限
return roleTemplate.project_permissions;
```

### 2. **权限验证**
```typescript
// 检查用户是否有特定项目权限
const hasPermission = (userId: string, projectId: string, permission: string) => {
  // 1. 检查项目分配权限
  const assignment = getUserProjectAssignment(userId, projectId);
  if (assignment) {
    return PROJECT_ROLE_PERMISSIONS[assignment.role].permissions.includes(permission);
  }
  
  // 2. 检查角色模板权限
  const userRole = getUserRole(userId);
  const roleTemplate = getRoleTemplate(userRole);
  return roleTemplate.project_permissions.includes(permission);
};
```

## 🎮 使用场景

### 1. **角色模板权限**
- 用户在角色模板中配置的项目权限
- 适用于所有项目的默认权限
- 通过权限管理界面配置

### 2. **项目分配权限**
- 用户对特定项目的权限
- 可以覆盖角色模板权限
- 通过项目分配界面配置

### 3. **权限优先级**
```
项目分配权限 > 角色模板权限 > 默认权限
```

## 📊 权限统计

### 1. **权限数量统计**
- **管理员**：8项权限
- **成员**：6项权限  
- **查看者**：4项权限

### 2. **权限范围**
- **项目访问**：基础访问权限
- **项目查看**：查看项目信息权限
- **项目管理**：管理项目权限
- **项目数据**：访问项目数据权限
- **财务数据**：财务相关权限
- **运营数据**：运营相关权限

## 🔧 技术实现

### 1. **权限映射常量**
```typescript
export const PROJECT_ROLE_PERMISSIONS = {
  admin: { permissions: [...], can_view: true, can_edit: true, can_delete: true },
  member: { permissions: [...], can_view: true, can_edit: true, can_delete: false },
  viewer: { permissions: [...], can_view: true, can_edit: false, can_delete: false }
};
```

### 2. **服务层集成**
```typescript
// 分配项目时自动设置对应权限
const rolePermissions = PROJECT_ROLE_PERMISSIONS[role];
await supabase.from('user_projects').upsert({
  user_id, project_id, role,
  can_view: rolePermissions.can_view,
  can_edit: rolePermissions.can_edit,
  can_delete: rolePermissions.can_delete
});
```

### 3. **界面显示**
```typescript
// 显示权限数量
const permissionCount = PROJECT_ROLE_PERMISSIONS[role].permissions.length;
<Badge>{roleText} ({permissionCount}项权限)</Badge>
```

## ✅ 集成优势

### 1. **一致性**
- 项目分配权限与角色模板权限保持一致
- 统一的权限检查逻辑
- 标准化的权限定义

### 2. **可维护性**
- 权限映射集中管理
- 易于添加新的角色类型
- 权限变更影响范围明确

### 3. **可扩展性**
- 支持细粒度权限控制
- 可以添加新的权限类型
- 支持权限继承和覆盖

### 4. **用户体验**
- 权限信息清晰显示
- 权限数量直观展示
- 操作结果可预期

## 🎉 总结

项目分配功能现在完全与权限系统集成，提供了：

- ✅ **权限一致性**：项目分配权限与角色模板权限保持一致
- ✅ **权限映射**：清晰的角色到权限的映射关系
- ✅ **权限检查**：统一的权限验证逻辑
- ✅ **权限显示**：直观的权限信息展示
- ✅ **权限管理**：完整的权限生命周期管理

这确保了权限系统的完整性和一致性，提供了更好的用户体验和系统可维护性！
