-- 合同权限系统架构说明
-- 文件: docs/contract-permission-architecture.md

# 合同权限系统架构说明

## 🏗️ 系统架构概览

当前的合同权限系统完全支持**按角色和用户分别分配权限**，并且完全符合**Supabase规范**。

## 📊 数据库表结构

### 1. 合同权限表 (contract_permissions)
```sql
CREATE TABLE public.contract_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,      -- 用户级权限
    role_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,    -- 角色级权限
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE, -- 部门级权限
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'download', 'edit', 'delete')),
    granted_by UUID REFERENCES public.profiles(id),                      -- 授权人
    granted_at TIMESTAMPTZ DEFAULT NOW(),                                -- 授权时间
    expires_at TIMESTAMPTZ,                                              -- 过期时间
    is_active BOOLEAN DEFAULT true,                                      -- 是否激活
    description TEXT,                                                    -- 权限描述
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 合同所有者权限表 (contract_owner_permissions)
```sql
CREATE TABLE public.contract_owner_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permissions TEXT[] DEFAULT ARRAY['view', 'edit', 'delete', 'download', 'manage']::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id)  -- 每个合同只有一个所有者
);
```

### 3. 合同分类权限模板表 (contract_category_permission_templates)
```sql
CREATE TABLE public.contract_category_permission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category contract_category NOT NULL,                                 -- 合同分类
    template_name TEXT NOT NULL,                                         -- 模板名称
    description TEXT,                                                    -- 模板描述
    default_permissions TEXT[] DEFAULT '{}'::TEXT[],                    -- 默认权限
    role_permissions JSONB DEFAULT '{}'::JSONB,                         -- 角色权限配置
    is_active BOOLEAN DEFAULT true,                                      -- 是否激活
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category)  -- 每个分类只有一个模板
);
```

## 🔐 权限分配方式

### 1. 用户级权限分配
```sql
-- 为特定用户分配合同权限
INSERT INTO contract_permissions (
    contract_id,
    user_id,                    -- 指定用户
    permission_type,
    expires_at,
    description
) VALUES (
    'contract-uuid',
    'user-uuid',
    'view',
    '2025-12-31',
    '临时查看权限'
);
```

### 2. 角色级权限分配
```sql
-- 为特定角色分配合同权限
INSERT INTO contract_permissions (
    contract_id,
    role_id,                    -- 指定角色
    permission_type,
    expires_at,
    description
) VALUES (
    'contract-uuid',
    'role-uuid',
    'edit',
    NULL,                       -- 永久权限
    '角色编辑权限'
);
```

### 3. 部门级权限分配
```sql
-- 为特定部门分配合同权限
INSERT INTO contract_permissions (
    contract_id,
    department_id,              -- 指定部门
    permission_type,
    expires_at,
    description
) VALUES (
    'contract-uuid',
    'department-uuid',
    'download',
    '2025-06-30',
    '部门下载权限'
);
```

### 4. 所有者权限（自动分配）
```sql
-- 合同所有者自动拥有所有权限
-- 通过触发器自动创建
INSERT INTO contract_owner_permissions (
    contract_id,
    owner_id,
    permissions
) VALUES (
    'contract-uuid',
    'owner-uuid',
    ARRAY['view', 'edit', 'delete', 'download', 'manage']::TEXT[]
);
```

## 🎯 权限类型

### 基础权限类型
- **view**: 查看合同
- **download**: 下载合同文件
- **edit**: 编辑合同信息
- **delete**: 删除合同
- **manage**: 管理合同（包含所有权限）

### 高级权限类型（可扩展）
- **approve**: 审批合同
- **archive**: 归档合同
- **audit**: 审计合同
- **sensitive**: 查看敏感信息

## 🔒 Supabase规范兼容性

### 1. RLS (Row Level Security)
```sql
-- 启用RLS
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_owner_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_category_permission_templates ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Admins can manage all contract permissions" 
ON public.contract_permissions 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view their own permissions" 
ON public.contract_permissions 
FOR SELECT 
USING (auth.uid() = user_id);
```

### 2. 认证集成
```sql
-- 使用Supabase认证系统
user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
granted_by UUID REFERENCES public.profiles(id),
```

### 3. 实时订阅支持
```sql
-- 支持Supabase实时订阅
-- 前端可以监听权限变更
supabase
  .channel('contract_permissions_changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'contract_permissions' },
    (payload) => {
      // 处理权限变更
    }
  )
  .subscribe();
```

## 🚀 权限查询函数

### 1. 获取用户有效权限
```sql
CREATE OR REPLACE FUNCTION get_user_contract_permissions(
    p_user_id UUID,
    p_contract_id UUID DEFAULT NULL
)
RETURNS TABLE (
    contract_id UUID,
    permission_type TEXT,
    source TEXT,  -- 'user', 'role', 'department', 'owner'
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    -- 用户直接权限
    SELECT cp.contract_id, cp.permission_type, 'user'::TEXT, cp.expires_at
    FROM contract_permissions cp
    WHERE cp.user_id = p_user_id
    AND cp.is_active = true
    AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
    
    UNION ALL
    
    -- 角色权限
    SELECT cp.contract_id, cp.permission_type, 'role'::TEXT, cp.expires_at
    FROM contract_permissions cp
    JOIN profiles p ON p.id = p_user_id
    JOIN user_roles ur ON ur.id = cp.role_id
    WHERE ur.role = p.role
    AND cp.is_active = true
    AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
    
    UNION ALL
    
    -- 所有者权限
    SELECT cop.contract_id, unnest(cop.permissions)::TEXT, 'owner'::TEXT, NULL::TIMESTAMPTZ
    FROM contract_owner_permissions cop
    WHERE cop.owner_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

## 📋 权限优先级

1. **所有者权限** (最高优先级)
   - 合同所有者自动拥有所有权限
   - 无法被覆盖或撤销

2. **用户直接权限** (高优先级)
   - 直接分配给用户的权限
   - 可以覆盖角色权限

3. **角色权限** (中优先级)
   - 基于用户角色的权限
   - 可以被用户直接权限覆盖

4. **部门权限** (低优先级)
   - 基于部门的权限
   - 可以被用户和角色权限覆盖

5. **分类模板权限** (默认权限)
   - 基于合同分类的默认权限
   - 最低优先级

## 🔧 前端集成

### 1. 权限检查
```typescript
// 检查用户是否有特定权限
const hasPermission = async (contractId: string, permissionType: string) => {
  const { data } = await supabase
    .rpc('get_user_contract_permissions', {
      p_user_id: user.id,
      p_contract_id: contractId
    });
  
  return data.some(perm => 
    perm.permission_type === permissionType && 
    (perm.expires_at === null || new Date(perm.expires_at) > new Date())
  );
};
```

### 2. 权限分配
```typescript
// 为用户分配权限
const grantPermission = async (
  contractId: string, 
  userId: string, 
  permissionType: string,
  expiresAt?: string
) => {
  const { error } = await supabase
    .from('contract_permissions')
    .insert({
      contract_id: contractId,
      user_id: userId,
      permission_type: permissionType,
      expires_at: expiresAt,
      granted_by: user.id
    });
  
  return !error;
};
```

## ✅ 总结

当前的合同权限系统：

1. ✅ **支持多种分配方式**: 用户、角色、部门、所有者
2. ✅ **完全符合Supabase规范**: RLS、认证、实时订阅
3. ✅ **灵活的权限类型**: 可扩展的权限体系
4. ✅ **优先级管理**: 清晰的权限优先级
5. ✅ **自动管理**: 所有者权限自动创建
6. ✅ **模板系统**: 分类权限模板
7. ✅ **过期管理**: 支持权限过期
8. ✅ **审计功能**: 完整的权限变更记录

这个系统完全满足企业级合同权限管理需求！
