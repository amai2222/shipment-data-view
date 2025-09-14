# 合同权限管理增强版使用指南

## 📋 概述

合同权限管理增强版解决了两个核心问题：
1. **用户自己合同的全权限**: 合同创建者自动拥有该合同的所有权限
2. **基于合同分类的权限策略**: 不同合同分类有不同的权限模板

## 🎯 核心功能

### 1. **合同分类权限管理**

#### 合同分类
- **行政合同**: 内部行政管理相关合同
- **内部合同**: 公司内部部门间合同
- **业务合同**: 对外业务合作合同

#### 分类权限模板
每个合同分类都有对应的权限模板，不同角色在不同分类下有不同的默认权限：

| 合同分类 | 角色 | 默认权限 |
|---------|------|----------|
| 行政合同 | 管理员 | 所有权限 |
| 行政合同 | 财务 | 查看、下载、敏感信息、审批 |
| 行政合同 | 业务 | 查看、下载、编辑、归档 |
| 行政合同 | 操作员 | 查看、下载 |
| 内部合同 | 管理员 | 所有权限 |
| 内部合同 | 财务 | 查看、下载、敏感信息 |
| 内部合同 | 业务 | 查看、下载、编辑、归档 |
| 业务合同 | 管理员 | 所有权限 |
| 业务合同 | 财务 | 查看、下载、敏感信息、审批 |
| 业务合同 | 业务 | 查看、下载、编辑、归档 |

### 2. **所有者权限机制**

#### 自动权限分配
- 合同创建时，创建者自动成为合同所有者
- 所有者自动拥有该合同的所有权限
- 所有者权限优先级最高，不受其他权限限制

#### 所有者权限特点
- **全权限**: 拥有所有权限类型
- **永久有效**: 不会过期
- **不可撤销**: 除非删除合同或转移所有权
- **最高优先级**: 覆盖所有其他权限设置

## 🔧 技术实现

### 1. **数据库设计**

#### 合同所有者权限表
```sql
CREATE TABLE contract_owner_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, owner_id)
);
```

#### 合同分类权限模板表
```sql
CREATE TABLE contract_category_permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category contract_category NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, role)
);
```

### 2. **权限检查逻辑**

#### 增强版权限检查函数
```sql
CREATE OR REPLACE FUNCTION check_enhanced_contract_permission(
  p_user_id UUID,
  p_contract_id UUID,
  p_permission_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  contract_category_val contract_category;
  user_role TEXT;
  has_permission BOOLEAN := FALSE;
BEGIN
  -- 1. 检查合同所有者权限（最高优先级）
  IF EXISTS(
    SELECT 1 FROM contract_owner_permissions 
    WHERE contract_id = p_contract_id 
      AND owner_id = p_user_id 
      AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- 2. 检查分类权限模板
  SELECT EXISTS(
    SELECT 1 FROM contract_category_permission_templates
    WHERE category = contract_category_val
      AND role = user_role
      AND p_permission_type = ANY(permissions)
      AND is_default = TRUE
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- 3. 检查直接权限
  -- 4. 检查角色权限
  -- ... 其他权限检查逻辑
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. **自动权限分配触发器**

#### 合同创建时自动分配权限
```sql
CREATE OR REPLACE FUNCTION auto_grant_contract_owner_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- 自动为合同创建者分配所有者权限
  INSERT INTO contract_owner_permissions (contract_id, owner_id)
  VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (contract_id, owner_id) DO NOTHING;
  
  -- 根据合同分类自动分配权限
  INSERT INTO contract_permissions (
    contract_id,
    user_id,
    permission_type,
    granted_by,
    granted_at
  )
  SELECT 
    NEW.id,
    NEW.user_id,
    unnest(permissions),
    NEW.user_id,
    NOW()
  FROM contract_category_permission_templates
  WHERE category = NEW.category
    AND role = (SELECT role FROM profiles WHERE id = NEW.user_id)
    AND is_default = TRUE
  ON CONFLICT (contract_id, user_id, role_id, department_id, permission_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 🎨 界面功能

### 1. **权限管理标签页**

#### 权限统计面板
- **总权限数**: 所有权限记录数量
- **有效权限**: 当前有效的权限数量
- **过期权限**: 已过期的权限数量
- **用户权限**: 用户级权限数量
- **所有者权限**: 合同所有者权限数量

#### 权限列表管理
- **搜索功能**: 支持按合同、用户、角色、部门搜索
- **筛选功能**: 支持按权限类型、目标类型、合同分类、状态筛选
- **批量操作**: 支持批量启用、禁用、删除权限
- **权限状态**: 可视化显示权限状态（有效/禁用/过期）

#### 权限分配
- **合同选择**: 选择要分配权限的合同（显示分类信息）
- **权限对象**: 选择用户、角色或部门
- **权限类型**: 选择具体的权限类型
- **过期时间**: 设置权限过期时间（可选）

### 2. **所有者权限标签页**

#### 所有者权限列表
- **合同信息**: 显示合同编号、对方公司、分类
- **所有者信息**: 显示所有者姓名、邮箱
- **授权时间**: 显示权限授予时间
- **状态**: 显示权限状态（有效/禁用）

#### 所有者权限特点
- **全权限标识**: 所有者权限显示为"全权限"
- **不可编辑**: 所有者权限不可直接编辑
- **自动管理**: 由系统自动管理

### 3. **分类模板标签页**

#### 分类权限模板管理
- **分类展示**: 按合同分类展示权限模板
- **角色权限**: 显示每个角色在不同分类下的权限
- **权限编辑**: 可以编辑分类权限模板
- **模板应用**: 新合同自动应用对应分类的权限模板

#### 模板管理功能
- **查看模板**: 查看所有分类的权限模板
- **编辑模板**: 修改分类权限模板
- **应用模板**: 将模板应用到现有合同
- **重置模板**: 重置为默认权限模板

## 🚀 使用步骤

### 1. **数据库初始化**
```sql
-- 执行增强版合同权限管理脚本
\i scripts/contract-category-permission-management.sql
```

### 2. **创建合同**
1. 创建合同时，系统自动：
   - 将创建者设为合同所有者
   - 为所有者分配全权限
   - 根据合同分类应用权限模板

### 3. **管理权限**
1. 进入"设置-集成权限管理-合同权限"
2. 在"权限管理"标签页中：
   - 查看所有权限记录
   - 使用筛选功能查找特定权限
   - 创建新的权限分配
   - 编辑或删除现有权限

### 4. **查看所有者权限**
1. 在"所有者权限"标签页中：
   - 查看所有合同的所有者权限
   - 了解权限分配情况
   - 监控权限使用情况

### 5. **管理分类模板**
1. 在"分类模板"标签页中：
   - 查看不同分类的权限模板
   - 编辑分类权限模板
   - 管理默认权限设置

## 📊 权限优先级

### 权限检查顺序
1. **所有者权限** (最高优先级)
   - 合同创建者自动拥有全权限
   - 不受其他权限限制
   - 永久有效

2. **分类权限模板**
   - 根据合同分类和用户角色自动分配
   - 新合同创建时自动应用
   - 可自定义修改

3. **直接权限**
   - 手动分配的特定权限
   - 可设置过期时间
   - 可随时修改或删除

4. **角色权限**
   - 基于用户角色的权限
   - 继承角色模板权限
   - 可被直接权限覆盖

## 🔍 权限检查示例

### 1. **合同创建者权限检查**
```typescript
// 检查合同创建者是否有编辑权限
const hasEditPermission = await ContractPermissionService.hasPermission(
  contractCreatorId,
  contractId,
  'edit'
);
// 返回 true（所有者权限）
```

### 2. **分类权限检查**
```typescript
// 检查财务人员对行政合同的查看权限
const hasViewPermission = await ContractPermissionService.hasPermission(
  financeUserId,
  adminContractId,
  'view'
);
// 返回 true（分类权限模板）
```

### 3. **直接权限检查**
```typescript
// 检查用户对特定合同的下载权限
const hasDownloadPermission = await ContractPermissionService.hasPermission(
  userId,
  contractId,
  'download'
);
// 根据直接权限设置返回结果
```

## 🎯 最佳实践

### 1. **权限分配原则**
- **最小权限原则**: 只授予必要的权限
- **分类管理**: 根据合同分类设置不同的权限策略
- **所有者优先**: 确保合同创建者拥有全权限
- **定期审查**: 定期检查和清理过期权限

### 2. **分类权限策略**
- **行政合同**: 财务和业务人员有较多权限
- **内部合同**: 限制外部访问，内部人员有编辑权限
- **业务合同**: 财务人员有审批权限，业务人员有管理权限

### 3. **权限监控**
- **所有者权限**: 监控合同创建者的权限使用
- **分类权限**: 监控不同分类的权限分配情况
- **权限变更**: 记录所有权限变更操作
- **权限过期**: 定期清理过期权限

## 🔧 故障排除

### 1. **常见问题**

**Q: 合同创建者没有全权限**
A: 检查`contract_owner_permissions`表是否正确创建，触发器是否正常工作。

**Q: 分类权限模板没有生效**
A: 检查`contract_category_permission_templates`表数据是否正确，权限检查函数是否更新。

**Q: 权限检查总是返回false**
A: 检查权限检查函数是否正确调用，数据库连接是否正常。

### 2. **调试工具**

```sql
-- 检查合同所有者权限
SELECT * FROM contract_owner_permissions 
WHERE contract_id = 'contract-uuid';

-- 检查分类权限模板
SELECT * FROM contract_category_permission_templates 
WHERE category = '行政合同' AND role = 'finance';

-- 检查权限检查函数
SELECT check_enhanced_contract_permission(
  'user-uuid',
  'contract-uuid',
  'edit'
);
```

### 3. **权限验证脚本**

```sql
-- 验证合同所有者权限
SELECT 
  c.contract_number,
  c.category,
  p.full_name as owner_name,
  cop.granted_at,
  cop.is_active
FROM contracts c
JOIN contract_owner_permissions cop ON cop.contract_id = c.id
JOIN profiles p ON p.id = cop.owner_id
ORDER BY c.created_at DESC;

-- 验证分类权限模板
SELECT 
  category,
  role,
  array_length(permissions, 1) as permission_count,
  permissions
FROM contract_category_permission_templates
ORDER BY category, role;
```

## 📚 相关文档

- [合同权限管理系统设计方案](./contract-permission-management-design.md)
- [集成权限管理使用指南](./integrated-contract-permission-guide.md)
- [合同权限管理最佳实践](./permission-management-best-practices.md)

## 🎉 总结

合同权限管理增强版提供了：

1. **自动权限分配**: 合同创建者自动拥有全权限
2. **分类权限管理**: 基于合同分类的权限模板
3. **权限优先级**: 清晰的权限检查顺序
4. **统一管理界面**: 在集成权限管理中统一管理
5. **完整审计跟踪**: 记录所有权限变更操作

这个增强版解决方案确保了合同权限管理的安全性、灵活性和易用性！
