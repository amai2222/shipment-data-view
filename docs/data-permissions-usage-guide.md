# 数据权限功能说明

## 📋 **数据权限概述**

数据权限是权限管理系统的重要组成部分，用于控制用户可以查看和操作的数据范围。与菜单权限、功能权限、项目权限不同，数据权限主要关注**数据的访问范围**和**操作权限**。

## 🎯 **数据权限类型**

### **1. 数据范围权限**
控制用户可以访问哪些数据：

- **所有数据** (`data.all`)
  - 可以访问系统中的所有数据
  - 适用于管理员和高级用户
  - 包括所有项目、所有用户创建的数据

- **自己的数据** (`data.own`)
  - 只能访问自己创建的数据
  - 适用于普通操作员
  - 限制数据查看范围，保护隐私

- **团队数据** (`data.team`)
  - 可以访问团队成员的数据
  - 适用于团队负责人
  - 便于团队协作和管理

- **项目数据** (`data.project`)
  - 可以访问指定项目的数据
  - 适用于项目相关人员
  - 基于项目进行数据隔离

### **2. 数据操作权限**
控制用户可以对数据执行哪些操作：

- **创建数据** (`data.create`)
  - 可以创建新的数据记录
  - 包括运单、磅单、合同等

- **编辑数据** (`data.edit`)
  - 可以修改现有数据
  - 包括更新、修正等操作

- **删除数据** (`data.delete`)
  - 可以删除数据记录
  - 通常限制给管理员

- **导出数据** (`data.export`)
  - 可以将数据导出为Excel等格式
  - 用于数据分析和备份

## 🔧 **如何使用数据权限**

### **1. 角色模板配置**
在角色权限模板中配置默认数据权限：

```typescript
// 管理员角色 - 拥有所有数据权限
admin: {
  data_permissions: [
    'data.all',           // 所有数据
    'data.create',        // 创建数据
    'data.edit',          // 编辑数据
    'data.delete',        // 删除数据
    'data.export'         // 导出数据
  ]
}

// 操作员角色 - 限制数据权限
operator: {
  data_permissions: [
    'data.own',           // 只能访问自己的数据
    'data.create',        // 可以创建数据
    'data.edit'           // 可以编辑数据
  ]
}
```

### **2. 用户特定权限**
为特定用户设置个性化的数据权限：

```typescript
// 用户特定数据权限配置
const userDataPermissions = {
  user_id: 'user-123',
  data_permissions: [
    'data.team',          // 可以访问团队数据
    'data.create',        // 可以创建数据
    'data.edit',          // 可以编辑数据
    'data.export'         // 可以导出数据
  ]
}
```

### **3. 权限检查**
在应用中检查用户的数据权限：

```typescript
// 检查用户是否有特定数据权限
const hasDataPermission = (userId: string, permission: string) => {
  const user = getUserPermissions(userId);
  return user.data_permissions.includes(permission);
}

// 检查用户是否可以访问特定数据
const canAccessData = (userId: string, dataOwner: string) => {
  const user = getUserPermissions(userId);
  
  if (user.data_permissions.includes('data.all')) {
    return true; // 可以访问所有数据
  }
  
  if (user.data_permissions.includes('data.own') && dataOwner === userId) {
    return true; // 可以访问自己的数据
  }
  
  if (user.data_permissions.includes('data.team')) {
    return isTeamMember(userId, dataOwner); // 检查是否是团队成员
  }
  
  return false;
}
```

## 📊 **数据权限界面说明**

### **权限状态显示**
- **继承** (绿色): 从角色模板继承的权限
- **自定义** (蓝色): 用户特定的权限设置
- **无权限** (灰色): 没有该权限

### **权限操作**
- **复选框**: 勾选/取消勾选权限
- **状态图标**: 显示权限状态
- **权限描述**: 说明权限的具体作用

### **权限统计**
- **已授权**: 用户拥有的权限数量
- **总权限**: 系统中可配置的权限总数
- **继承权限**: 从角色继承的权限数量
- **自定义权限**: 用户特定的权限数量

## 🚀 **最佳实践**

### **1. 权限设计原则**
- **最小权限原则**: 只给用户必要的权限
- **分层管理**: 不同角色有不同的数据访问范围
- **动态调整**: 根据业务需要调整权限

### **2. 常见配置场景**

**场景1: 新员工入职**
```typescript
// 新员工默认权限
newEmployee: {
  data_permissions: [
    'data.own',           // 只能访问自己的数据
    'data.create'         // 可以创建数据
  ]
}
```

**场景2: 项目负责人**
```typescript
// 项目负责人权限
projectManager: {
  data_permissions: [
    'data.project',       // 可以访问项目数据
    'data.create',        // 可以创建数据
    'data.edit',          // 可以编辑数据
    'data.export'         // 可以导出数据
  ]
}
```

**场景3: 财务人员**
```typescript
// 财务人员权限
finance: {
  data_permissions: [
    'data.all',           // 可以访问所有数据
    'data.edit',          // 可以编辑财务数据
    'data.export'         // 可以导出财务报表
  ]
}
```

### **3. 权限监控**
- 定期检查权限配置
- 监控权限使用情况
- 及时调整不合理的权限

## 🔍 **故障排除**

### **常见问题**

**Q: 用户看不到某些数据？**
A: 检查用户的数据范围权限，确保有相应的访问权限。

**Q: 用户无法编辑数据？**
A: 检查用户是否有 `data.edit` 权限。

**Q: 权限显示不正确？**
A: 检查角色模板配置和用户特定权限设置。

### **调试步骤**
1. 检查用户角色
2. 检查角色权限模板
3. 检查用户特定权限
4. 检查权限计算逻辑
5. 检查前端权限显示

## 📝 **总结**

数据权限功能现在已经完全实现，包括：
- ✅ 数据范围权限配置
- ✅ 数据操作权限配置
- ✅ 权限状态显示
- ✅ 权限统计计算
- ✅ 权限操作界面

您现在可以：
1. 在权限管理界面配置数据权限
2. 为不同角色设置不同的数据访问范围
3. 为用户设置个性化的数据权限
4. 实时查看权限状态和统计信息

数据权限将帮助您更好地控制用户的数据访问范围，提高系统的安全性和数据保护能力！
