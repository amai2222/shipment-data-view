# 权限重置逻辑优化

## 🎯 问题描述

**原始问题**：权限重置功能使用硬编码的 `DEFAULT_ROLE_PERMISSIONS`，导致：
- 角色模板权限变化后，重置功能仍使用旧的硬编码权限
- 无法反映数据库中最新的角色模板权限
- 权限管理不一致

## ✅ 解决方案

### 1. **修改权限重置逻辑**

**修改前**：
```typescript
// 使用硬编码权限
const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole];
```

**修改后**：
```typescript
// 从数据库读取角色模板权限
const { data: roleTemplate } = await supabase
  .from('role_permission_templates')
  .select('menu_permissions, function_permissions, project_permissions, data_permissions')
  .eq('role', userRole)
  .single();
```

### 2. **新的重置流程**

1. **获取用户角色**：从 `profiles` 表读取用户角色
2. **读取角色模板**：从 `role_permission_templates` 表读取最新权限
3. **删除自定义权限**：清除 `user_permissions` 表中的用户自定义权限
4. **应用模板权限**：将角色模板权限应用到用户

### 3. **保留的硬编码使用**

**仅用于系统初始化**：
```typescript
// 仅用于系统初始化或紧急恢复
static async resetRoleTemplateToSystemDefault(role: UserRole): Promise<void>
```

## 🔄 权限同步机制

### 角色模板权限变化 → 用户权限重置

1. **管理员修改角色模板**：在角色模板管理界面修改权限
2. **权限立即生效**：新用户自动获得新权限
3. **现有用户重置**：使用重置功能获得最新权限

### 示例场景

**场景**：管理员为 `operator` 角色添加了新的菜单权限

1. **修改前**：
   - 角色模板：`operator` 有 10 个菜单权限
   - 用户 A：有 10 个菜单权限
   - 重置后：仍然是 10 个权限（使用硬编码）

2. **修改后**：
   - 角色模板：`operator` 有 15 个菜单权限
   - 用户 A：有 10 个菜单权限
   - 重置后：获得 15 个权限（从数据库读取）

## 🎯 优势

### 1. **权限一致性**
- ✅ 重置功能始终使用最新的角色模板权限
- ✅ 角色模板变化立即反映到重置功能
- ✅ 消除硬编码与数据库不一致的问题

### 2. **动态权限管理**
- ✅ 支持动态角色系统
- ✅ 新创建的角色自动支持重置功能
- ✅ 权限模板修改无需代码更新

### 3. **用户体验**
- ✅ 重置功能更加直观和可预测
- ✅ 管理员可以安全地修改角色模板
- ✅ 用户权限始终与角色模板保持同步

## 🔧 实现细节

### 核心方法

```typescript
// 新的重置方法
static async resetUserToRoleDefault(userId: string): Promise<void> {
  // 1. 获取用户角色
  const userProfile = await supabase.from('profiles').select('role').eq('id', userId).single();
  
  // 2. 从数据库读取角色模板权限
  const roleTemplate = await supabase
    .from('role_permission_templates')
    .select('menu_permissions, function_permissions, project_permissions, data_permissions')
    .eq('role', userProfile.role)
    .single();
  
  // 3. 删除用户自定义权限
  await supabase.from('user_permissions').delete().eq('user_id', userId);
  
  // 4. 应用角色模板权限
  await supabase.from('user_permissions').upsert({
    user_id: userId,
    menu_permissions: roleTemplate.menu_permissions,
    function_permissions: roleTemplate.function_permissions,
    project_permissions: roleTemplate.project_permissions,
    data_permissions: roleTemplate.data_permissions,
    created_by: currentUserId
  });
}
```

### 错误处理

- ✅ 角色模板不存在时跳过重置
- ✅ 用户不存在时抛出错误
- ✅ 数据库操作失败时回滚

## 🎉 总结

**权限重置逻辑已完全优化**：

- ✅ **消除硬编码**：重置功能不再使用硬编码权限
- ✅ **动态同步**：权限重置始终使用最新的角色模板权限
- ✅ **一致性保证**：角色模板变化立即反映到重置功能
- ✅ **向后兼容**：保留系统初始化功能

现在权限管理系统完全基于数据库，实现了真正的动态权限管理！
