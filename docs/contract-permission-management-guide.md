# 合同权限管理系统使用指南

## 📋 系统概述

合同权限管理系统是一个完整的细粒度权限控制解决方案，支持用户、角色、部门等多维度的权限管理，确保合同数据的安全性和合规性。

## 🚀 快速开始

### 1. 数据库初始化

首先运行数据库迁移脚本：

```sql
-- 执行数据库迁移
\i scripts/contract-permission-management-migration.sql
```

### 2. 组件集成

在合同管理页面中集成权限管理组件：

```typescript
import { ContractPermissionManager } from '@/components/contracts/ContractPermissionManagerNew';

// 全局权限管理
<ContractPermissionManager 
  mode="global" 
  onPermissionUpdate={() => {
    // 权限更新后的回调
    console.log('权限已更新');
  }}
/>

// 特定合同权限管理
<ContractPermissionManager 
  contractId="contract-uuid"
  mode="contract-specific"
  onPermissionUpdate={() => {
    // 权限更新后的回调
  }}
/>
```

### 3. 权限检查

在需要权限控制的地方使用权限检查：

```typescript
import { ContractPermissionService } from '@/services/ContractPermissionService';

// 检查权限
const hasPermission = await ContractPermissionService.hasPermission(
  userId,
  contractId,
  'edit'
);

if (hasPermission) {
  // 允许编辑
} else {
  // 显示权限不足提示
}
```

## 🎯 核心功能

### 1. 权限类型

系统支持以下权限类型：

- **查看 (view)**: 查看合同基本信息
- **下载 (download)**: 下载合同文件
- **编辑 (edit)**: 修改合同信息
- **删除 (delete)**: 删除合同记录
- **管理 (manage)**: 管理合同权限
- **敏感信息 (sensitive)**: 查看金额、条款等敏感信息
- **审批 (approve)**: 审批合同
- **归档 (archive)**: 归档合同
- **审计 (audit)**: 查看审计日志

### 2. 权限分配维度

#### 用户级权限
直接分配给特定用户，支持临时权限和永久权限。

```typescript
// 创建用户权限
await ContractPermissionService.createPermission({
  contract_id: 'contract-uuid',
  user_id: 'user-uuid',
  permission_type: 'edit',
  expires_at: '2024-12-31T23:59:59Z' // 可选过期时间
});
```

#### 角色级权限
基于用户角色的权限模板，支持角色继承。

```typescript
// 创建角色权限
await ContractPermissionService.createPermission({
  contract_id: 'contract-uuid',
  role_id: 'admin',
  permission_type: 'manage'
});
```

#### 部门级权限
基于组织架构的权限分配。

```typescript
// 创建部门权限
await ContractPermissionService.createPermission({
  contract_id: 'contract-uuid',
  department_id: 'department-uuid',
  permission_type: 'view'
});
```

### 3. 权限管理界面

#### 权限列表
- 表格形式展示所有权限记录
- 支持按合同、用户、角色、部门筛选
- 支持权限状态筛选（有效/过期/禁用）
- 支持批量操作（启用/禁用/删除）

#### 权限统计
- 总权限数量统计
- 按权限类型分布统计
- 按用户/角色/部门分布统计
- 权限使用情况分析

#### 新增权限
- 合同选择器（支持搜索和筛选）
- 权限对象选择（用户/角色/部门）
- 权限类型多选框
- 过期时间设置
- 权限说明输入

## 🔒 安全控制

### 1. 前端权限控制

```typescript
import { useContractPermission } from '@/services/ContractPermissionService';

function ContractEditButton({ contractId }: { contractId: string }) {
  const { hasPermission, loading } = useContractPermission(contractId, 'edit');
  
  if (loading) return <LoadingSpinner />;
  if (!hasPermission) return null;
  
  return <Button onClick={handleEdit}>编辑合同</Button>;
}
```

### 2. 组件级权限控制

```typescript
import { withContractPermission } from '@/services/ContractPermissionService';

const ContractSensitiveFields = withContractPermission(
  SensitiveFieldsComponent,
  'sensitive'
);
```

### 3. 路由级权限控制

```typescript
// 路由守卫
const ContractManagementRoute = () => {
  const { hasPermission } = useContractPermission('', 'view');
  
  if (!hasPermission) {
    return <Navigate to="/unauthorized" />;
  }
  
  return <ContractManagement />;
};
```

## 📊 权限矩阵

### 角色权限矩阵

| 权限类型 | 管理员 | 财务 | 业务 | 操作员 | 查看者 |
|---------|--------|------|------|--------|--------|
| 查看合同 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 下载文件 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 编辑合同 | ✅ | ❌ | ✅ | ❌ | ❌ |
| 删除合同 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 管理权限 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 敏感信息 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 审批合同 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 归档合同 | ✅ | ❌ | ✅ | ❌ | ❌ |

### 合同状态权限矩阵

| 合同状态 | 查看 | 编辑 | 删除 | 审批 | 归档 |
|---------|------|------|------|------|------|
| 草稿 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 待审批 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 已审批 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 已归档 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 已终止 | ✅ | ❌ | ❌ | ❌ | ❌ |

## 🔧 高级功能

### 1. 权限模板

使用权限模板快速分配权限：

```typescript
// 获取权限模板
const templates = await ContractPermissionService.getPermissionTemplates();

// 应用模板
const template = templates.find(t => t.name === '财务权限');
if (template) {
  await ContractPermissionService.createPermission({
    contract_id: 'contract-uuid',
    user_id: 'user-uuid',
    permission_type: template.permissions[0] // 应用模板权限
  });
}
```

### 2. 批量权限管理

```typescript
// 批量创建权限
const permissions = [
  { contract_id: 'contract-1', user_id: 'user-1', permission_type: 'view' },
  { contract_id: 'contract-2', user_id: 'user-1', permission_type: 'view' }
];

await ContractPermissionService.createBulkPermissions(permissions);

// 批量更新权限状态
await ContractPermissionService.updateBulkPermissionStatus(
  ['permission-1', 'permission-2'],
  false // 禁用
);
```

### 3. 审计日志

记录所有权限相关操作：

```typescript
// 记录访问日志
await ContractPermissionService.logAccess(
  contractId,
  userId,
  'view',
  { ip: '192.168.1.1', userAgent: 'Chrome' }
);

// 获取访问历史
const history = await ContractPermissionService.getContractAccessHistory(
  contractId,
  100
);
```

### 4. 权限统计

```typescript
// 获取权限统计
const stats = await ContractPermissionService.getPermissionStats();

// 获取用户权限汇总
const userSummary = await ContractPermissionService.getUserPermissionSummary();
```

## 🎨 界面定制

### 1. 权限类型图标

```typescript
const permissionTypes = [
  { value: 'view', label: '查看', icon: Eye, color: 'bg-blue-100 text-blue-800' },
  { value: 'download', label: '下载', icon: Download, color: 'bg-green-100 text-green-800' },
  // ... 更多权限类型
];
```

### 2. 权限状态显示

```typescript
const getPermissionStatus = (permission: ContractPermission) => {
  if (!permission.is_active) return 'disabled';
  if (permission.expires_at && new Date(permission.expires_at) < new Date()) {
    return 'expired';
  }
  return 'active';
};
```

### 3. 权限筛选器

```typescript
const PermissionFilters = ({ filters, onFiltersChange }) => {
  return (
    <div className="flex gap-4">
      <Select value={filters.permissionType} onValueChange={...}>
        <SelectTrigger>
          <SelectValue placeholder="权限类型" />
        </SelectTrigger>
        <SelectContent>
          {permissionTypes.map(type => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* 更多筛选器 */}
    </div>
  );
};
```

## 📈 性能优化

### 1. 权限缓存

```typescript
// 使用React Query缓存权限数据
const { data: permissions } = useQuery({
  queryKey: ['contract-permissions', contractId],
  queryFn: () => ContractPermissionService.getContractPermissions(contractId),
  staleTime: 5 * 60 * 1000, // 5分钟缓存
});
```

### 2. 批量操作

```typescript
// 批量权限检查
const checkMultiplePermissions = async (contractIds: string[], permissionType: string) => {
  const promises = contractIds.map(id => 
    ContractPermissionService.hasPermission(userId, id, permissionType)
  );
  return Promise.all(promises);
};
```

### 3. 权限预加载

```typescript
// 预加载用户权限
useEffect(() => {
  if (user) {
    ContractPermissionService.getUserContractPermissions(user.id);
  }
}, [user]);
```

## 🔍 故障排除

### 1. 常见问题

**Q: 权限检查总是返回false**
A: 检查用户是否已登录，权限是否已激活，是否已过期。

**Q: 无法创建权限**
A: 检查数据库表是否存在，用户是否有创建权限的权限。

**Q: 权限列表为空**
A: 检查RLS策略是否正确配置，用户是否有查看权限的权限。

### 2. 调试工具

```typescript
// 启用权限调试
const DEBUG_PERMISSIONS = process.env.NODE_ENV === 'development';

if (DEBUG_PERMISSIONS) {
  console.log('权限检查:', { userId, contractId, permissionType, result });
}
```

### 3. 日志监控

```typescript
// 监控权限操作
const logPermissionOperation = (operation: string, details: any) => {
  console.log(`[权限操作] ${operation}:`, details);
};
```

## 📚 API 参考

### ContractPermissionService

#### 方法列表

- `hasPermission(userId, contractId, permissionType)`: 检查权限
- `getUserContractPermissions(userId)`: 获取用户权限
- `getContractPermissions(contractId)`: 获取合同权限
- `createPermission(permission)`: 创建权限
- `updatePermission(permissionId, updates)`: 更新权限
- `deletePermission(permissionId)`: 删除权限
- `createBulkPermissions(permissions)`: 批量创建权限
- `logAccess(contractId, userId, action, details)`: 记录访问日志
- `getContractAccessHistory(contractId, limit)`: 获取访问历史
- `getPermissionTemplates()`: 获取权限模板
- `getDepartments()`: 获取部门列表
- `getPermissionStats()`: 获取权限统计
- `getUserPermissionSummary()`: 获取用户权限汇总

#### 数据类型

- `ContractPermission`: 合同权限
- `ContractAccessLog`: 合同访问日志
- `PermissionTemplate`: 权限模板
- `Department`: 部门信息

## 🎯 最佳实践

1. **最小权限原则**: 只授予必要的权限
2. **定期审查**: 定期检查和清理过期权限
3. **权限分离**: 将敏感权限与普通权限分离
4. **审计跟踪**: 记录所有权限变更操作
5. **权限模板**: 使用模板统一权限管理
6. **批量操作**: 使用批量操作提高效率
7. **缓存优化**: 合理使用缓存减少数据库查询
8. **错误处理**: 完善的错误处理和用户提示

这个合同权限管理系统提供了完整的权限控制解决方案，支持细粒度的权限管理，确保合同数据的安全性和合规性。
