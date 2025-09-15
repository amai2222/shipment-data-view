# 权限审计日志问题解决方案

## 🔍 问题分析

### 发现的问题
1. **表不存在**：`permission_change_log` 表已被删除（在 `supabase/migrations/20250127000001_remove_unused_permission_tables.sql` 中）
2. **前端引用**：前端审计日志页面可能还在尝试访问这个不存在的表
3. **权限状态显示**：图片显示 `permission_change_log` 为"Unrestricted"状态

### 根本原因
- `permission_change_log` 表在迁移中被删除
- 前端代码可能还在引用这个表
- 需要统一使用 `permission_audit_logs` 表

## ✅ 解决方案

### 1. **检查并修复前端代码**

#### 检查审计日志页面
```typescript
// src/pages/Settings/AuditLogs.tsx
// 确保只使用 permission_audit_logs 表
const { data, error } = await supabase
  .from('permission_audit_logs')  // ✅ 正确的表名
  .select('*')
  .order('created_at', { ascending: false });
```

#### 检查 useAuditLogs Hook
```typescript
// src/hooks/useAuditLogs.ts
// 确保查询的是正确的表
let query = supabase
  .from('permission_audit_logs')  // ✅ 正确的表名
  .select('id, user_id, action, permission_type, permission_key, ...')
  .order('created_at', { ascending: false });
```

### 2. **创建权限审计日志修复脚本**

```sql
-- 修复权限审计日志系统
-- 文件: scripts/fix_audit_logs_system.sql

-- 1. 确保 permission_audit_logs 表存在且结构正确
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('grant', 'revoke', 'modify', 'inherit', 'create', 'update', 'delete', 'activate', 'deactivate')),
  permission_type text NOT NULL CHECK (permission_type IN ('menu', 'function', 'project', 'data', 'role', 'user')),
  permission_key text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 2. 确保 RLS 策略正确
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "Admins can create audit logs" ON public.permission_audit_logs;

-- 创建新策略
CREATE POLICY "Admins can view all audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Users can view their own audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "Admins can create audit logs" 
ON public.permission_audit_logs 
FOR INSERT 
WITH CHECK (is_admin());

-- 3. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON public.permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON public.permission_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_action ON public.permission_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_permission_type ON public.permission_audit_logs(permission_type);

-- 4. 确保日志记录函数存在
CREATE OR REPLACE FUNCTION log_permission_change(
  p_user_id uuid,
  p_action text,
  p_permission_type text,
  p_permission_key text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_project_id uuid DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.permission_audit_logs (
    user_id,
    action,
    permission_type,
    permission_key,
    target_user_id,
    target_project_id,
    old_value,
    new_value,
    reason,
    created_by
  ) VALUES (
    p_user_id,
    p_action,
    p_permission_type,
    p_permission_key,
    p_target_user_id,
    p_target_project_id,
    p_old_value,
    p_new_value,
    p_reason,
    auth.uid()
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to log permission change: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 插入一些示例数据（如果表为空）
INSERT INTO public.permission_audit_logs (
  user_id,
  action,
  permission_type,
  permission_key,
  reason,
  created_by
)
SELECT 
  p.id,
  'grant',
  'menu',
  'dashboard',
  '系统初始化',
  p.id
FROM public.profiles p
WHERE p.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM public.permission_audit_logs LIMIT 1)
LIMIT 1;

-- 6. 验证修复结果
SELECT 
  '权限审计日志表状态' as status,
  COUNT(*) as total_logs,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT action) as unique_actions
FROM public.permission_audit_logs;

-- 7. 显示最近的审计日志
SELECT 
  pal.id,
  pal.action,
  pal.permission_type,
  pal.permission_key,
  pal.reason,
  pal.created_at,
  p.full_name as user_name
FROM public.permission_audit_logs pal
LEFT JOIN public.profiles p ON pal.user_id = p.id
ORDER BY pal.created_at DESC
LIMIT 10;
```

### 3. **前端代码修复**

#### 修复审计日志页面
```typescript
// src/pages/Settings/AuditLogs.tsx
// 确保只使用正确的表名
const loadAuditLogs = useCallback(async (filters: AuditLogFilters = {}) => {
  try {
    setLoading(true);
    
    // ✅ 使用正确的表名
    let query = supabase
      .from('permission_audit_logs')  // 正确的表名
      .select('id, user_id, action, permission_type, permission_key, target_user_id, target_project_id, old_value, new_value, reason, created_at, created_by')
      .order('created_at', { ascending: false });

    // ... 其他查询逻辑
  } catch (error) {
    console.error('查询审计日志失败:', error);
    toast({
      title: "错误",
      description: "查询审计日志失败",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
}, [page, pageSize]);
```

### 4. **权限状态修复**

#### 检查权限状态显示
```typescript
// 确保权限状态正确显示
const getPermissionStatus = (permissionType: string) => {
  switch (permissionType) {
    case 'permission_audit_logs':
      return 'Restricted'; // ✅ 正确的状态
    case 'permission_change_log':
      return 'Table Removed'; // ✅ 显示表已删除
    default:
      return 'Unknown';
  }
};
```

## 🚀 执行步骤

### 1. **执行数据库修复脚本**
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f scripts/fix_audit_logs_system.sql
```

### 2. **检查前端代码**
- 确保所有审计日志相关代码都使用 `permission_audit_logs` 表
- 移除对 `permission_change_log` 表的任何引用

### 3. **验证修复结果**
- 检查审计日志页面是否正常显示
- 验证权限状态显示正确
- 测试审计日志功能是否正常工作

## ⚠️ 注意事项

### 1. **数据一致性**
- 确保所有审计日志都记录在 `permission_audit_logs` 表中
- 移除对已删除表的任何引用

### 2. **权限控制**
- 确保 RLS 策略正确配置
- 只有管理员可以查看所有审计日志
- 用户可以查看自己的审计日志

### 3. **性能优化**
- 确保索引正确创建
- 考虑审计日志的清理策略

## 🎯 预期结果

修复完成后：
- ✅ 审计日志页面正常显示
- ✅ 权限状态显示正确
- ✅ 不再有"Unrestricted"状态
- ✅ 所有审计日志功能正常工作

---

**解决方案已提供！** 请按照上述步骤执行修复脚本，并检查前端代码是否正确使用 `permission_audit_logs` 表。
