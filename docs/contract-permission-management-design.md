# 合同权限管理系统设计方案

## 📋 系统概述

合同权限管理系统是一个细粒度的权限控制体系，支持用户、角色、部门等多维度的权限管理，确保合同数据的安全性和合规性。

## 🎯 核心功能模块

### 1. 权限类型定义

#### 基础权限类型
- **查看权限 (view)**: 可以查看合同基本信息
- **下载权限 (download)**: 可以下载合同文件
- **编辑权限 (edit)**: 可以修改合同信息
- **删除权限 (delete)**: 可以删除合同记录
- **管理权限 (manage)**: 可以管理合同权限

#### 高级权限类型
- **敏感信息权限 (sensitive)**: 可以查看金额、条款等敏感信息
- **审批权限 (approve)**: 可以审批合同
- **归档权限 (archive)**: 可以归档合同
- **审计权限 (audit)**: 可以查看审计日志

### 2. 权限分配维度

#### 用户级权限
- 直接分配给特定用户
- 支持临时权限和永久权限
- 支持权限过期时间设置

#### 角色级权限
- 基于用户角色的权限模板
- 支持角色继承和覆盖
- 便于批量权限管理

#### 部门级权限
- 基于组织架构的权限分配
- 支持部门权限继承
- 便于部门级权限管理

#### 合同级权限
- 针对特定合同的权限设置
- 支持合同分类权限
- 支持合同状态相关权限

## 🏗️ 数据库设计

### 1. 合同权限表 (contract_permissions)

```sql
CREATE TABLE contract_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES role_permission_templates(role) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'download', 'edit', 'delete', 'manage', 'sensitive', 'approve', 'archive', 'audit')),
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束：至少指定一个权限对象
  CONSTRAINT check_permission_target CHECK (
    user_id IS NOT NULL OR role_id IS NOT NULL OR department_id IS NOT NULL
  ),
  
  -- 约束：权限类型与权限对象的组合唯一
  CONSTRAINT unique_permission UNIQUE (
    contract_id, 
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(role_id, ''),
    COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
    permission_type
  )
);
```

### 2. 合同访问日志表 (contract_access_logs)

```sql
CREATE TABLE contract_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'edit', 'delete', 'create', 'approve', 'archive')),
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);
```

### 3. 权限模板表 (contract_permission_templates)

```sql
CREATE TABLE contract_permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🎨 前端界面设计

### 1. 权限管理主界面

#### 权限列表视图
- 表格形式展示所有权限记录
- 支持按合同、用户、角色、部门筛选
- 支持权限状态筛选（有效/过期/禁用）
- 支持批量操作（启用/禁用/删除）

#### 权限统计面板
- 总权限数量统计
- 按权限类型分布统计
- 按用户/角色/部门分布统计
- 权限使用情况分析

### 2. 新增权限界面

#### 权限分配表单
- 合同选择器（支持搜索和筛选）
- 权限对象选择（用户/角色/部门）
- 权限类型多选框
- 过期时间设置
- 权限说明输入

#### 批量权限分配
- 支持选择多个合同
- 支持选择多个用户/角色/部门
- 支持批量设置权限类型
- 支持批量设置过期时间

### 3. 权限详情界面

#### 权限信息展示
- 权限基本信息
- 权限历史记录
- 权限使用统计
- 相关合同信息

#### 权限编辑功能
- 修改权限类型
- 调整过期时间
- 启用/禁用权限
- 添加权限说明

## 🔧 核心功能实现

### 1. 权限检查服务

```typescript
class ContractPermissionService {
  // 检查用户是否有特定权限
  async hasPermission(
    userId: string, 
    contractId: string, 
    permissionType: string
  ): Promise<boolean> {
    // 1. 检查用户直接权限
    const userPermission = await this.checkUserPermission(userId, contractId, permissionType);
    if (userPermission) return true;
    
    // 2. 检查角色权限
    const rolePermission = await this.checkRolePermission(userId, contractId, permissionType);
    if (rolePermission) return true;
    
    // 3. 检查部门权限
    const departmentPermission = await this.checkDepartmentPermission(userId, contractId, permissionType);
    if (departmentPermission) return true;
    
    return false;
  }
  
  // 获取用户的所有合同权限
  async getUserContractPermissions(userId: string): Promise<ContractPermission[]> {
    // 合并用户、角色、部门权限
    // 去重和优先级处理
  }
  
  // 权限继承和覆盖逻辑
  private async resolvePermissionConflicts(permissions: ContractPermission[]): Promise<ContractPermission[]> {
    // 处理权限冲突和继承关系
  }
}
```

### 2. 权限管理组件

```typescript
interface ContractPermissionManagerProps {
  contractId?: string;
  mode: 'global' | 'contract-specific';
  onPermissionUpdate?: () => void;
}

export function ContractPermissionManager({ 
  contractId, 
  mode, 
  onPermissionUpdate 
}: ContractPermissionManagerProps) {
  // 权限列表管理
  const [permissions, setPermissions] = useState<ContractPermission[]>([]);
  
  // 权限筛选和搜索
  const [filters, setFilters] = useState({
    permissionType: '',
    targetType: '',
    status: 'active'
  });
  
  // 批量操作
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // 权限统计
  const permissionStats = useMemo(() => {
    return calculatePermissionStats(permissions);
  }, [permissions]);
  
  return (
    <div className="space-y-6">
      {/* 权限统计面板 */}
      <PermissionStatsPanel stats={permissionStats} />
      
      {/* 权限筛选器 */}
      <PermissionFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
      />
      
      {/* 权限列表 */}
      <PermissionList 
        permissions={filteredPermissions}
        selectedPermissions={selectedPermissions}
        onSelectionChange={setSelectedPermissions}
        onPermissionUpdate={handlePermissionUpdate}
      />
      
      {/* 批量操作工具栏 */}
      <BulkActionToolbar 
        selectedCount={selectedPermissions.length}
        onBulkAction={handleBulkAction}
      />
    </div>
  );
}
```

### 3. 权限分配向导

```typescript
interface PermissionWizardProps {
  contracts: Contract[];
  users: User[];
  roles: Role[];
  departments: Department[];
  onComplete: (permissions: ContractPermission[]) => void;
}

export function PermissionWizard({ 
  contracts, 
  users, 
  roles, 
  departments, 
  onComplete 
}: PermissionWizardProps) {
  const [step, setStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    selectedContracts: [],
    selectedTargets: [],
    permissionTypes: [],
    expiresAt: null,
    description: ''
  });
  
  const steps = [
    { title: '选择合同', component: ContractSelector },
    { title: '选择对象', component: TargetSelector },
    { title: '设置权限', component: PermissionSelector },
    { title: '确认设置', component: ConfirmationStep }
  ];
  
  return (
    <div className="permission-wizard">
      {/* 步骤指示器 */}
      <StepIndicator steps={steps} currentStep={step} />
      
      {/* 步骤内容 */}
      <div className="step-content">
        {steps[step - 1].component}
      </div>
      
      {/* 导航按钮 */}
      <WizardNavigation 
        step={step}
        totalSteps={steps.length}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onComplete={handleComplete}
      />
    </div>
  );
}
```

## 📊 权限矩阵设计

### 1. 角色权限矩阵

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

### 2. 合同状态权限矩阵

| 合同状态 | 查看 | 编辑 | 删除 | 审批 | 归档 |
|---------|------|------|------|------|------|
| 草稿 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 待审批 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 已审批 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 已归档 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 已终止 | ✅ | ❌ | ❌ | ❌ | ❌ |

## 🔒 安全控制机制

### 1. 权限验证中间件

```typescript
// 路由级权限控制
export const requireContractPermission = (permissionType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { contractId } = req.params;
    const userId = req.user.id;
    
    const hasPermission = await contractPermissionService.hasPermission(
      userId, 
      contractId, 
      permissionType
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
};

// 组件级权限控制
export const withContractPermission = (
  WrappedComponent: React.ComponentType,
  permissionType: string
) => {
  return (props: any) => {
    const { contractId } = props;
    const { user } = useAuth();
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      checkPermission();
    }, [contractId, user.id]);
    
    const checkPermission = async () => {
      const permission = await contractPermissionService.hasPermission(
        user.id, 
        contractId, 
        permissionType
      );
      setHasPermission(permission);
      setLoading(false);
    };
    
    if (loading) return <LoadingSpinner />;
    if (!hasPermission) return <AccessDenied />;
    
    return <WrappedComponent {...props} />;
  };
};
```

### 2. 审计日志记录

```typescript
class ContractAuditLogger {
  async logAccess(
    contractId: string,
    userId: string,
    action: string,
    details?: any
  ) {
    await supabase.from('contract_access_logs').insert({
      contract_id: contractId,
      user_id: userId,
      action,
      ip_address: this.getClientIP(),
      user_agent: this.getUserAgent(),
      details
    });
  }
  
  async getAccessHistory(contractId: string, limit = 100) {
    const { data } = await supabase
      .from('contract_access_logs')
      .select(`
        *,
        profiles!inner(full_name, email)
      `)
      .eq('contract_id', contractId)
      .order('accessed_at', { ascending: false })
      .limit(limit);
    
    return data;
  }
}
```

## 🚀 实施计划

### 阶段一：基础功能 (1-2周)
1. 数据库表结构创建
2. 基础权限管理界面
3. 权限检查服务实现
4. 基础权限分配功能

### 阶段二：高级功能 (2-3周)
1. 权限模板系统
2. 批量权限管理
3. 权限继承和覆盖
4. 权限统计和分析

### 阶段三：安全增强 (1-2周)
1. 审计日志系统
2. 权限验证中间件
3. 安全控制机制
4. 权限监控和告警

### 阶段四：优化完善 (1周)
1. 性能优化
2. 用户体验优化
3. 文档完善
4. 测试和调试

## 📈 预期效果

1. **安全性提升**: 细粒度权限控制，确保合同数据安全
2. **管理效率**: 批量权限管理，提高管理效率
3. **合规性**: 完整的审计日志，满足合规要求
4. **用户体验**: 直观的权限管理界面，提升用户体验
5. **可扩展性**: 灵活的权限体系，支持未来扩展

这个设计方案提供了完整的合同权限管理解决方案，包括数据库设计、前端界面、核心功能和安全控制机制。您觉得这个方案如何？需要我详细实现某个部分吗？
