# PostgreSQL 枚举值限制解决方案

## 🚨 问题描述

PostgreSQL 有一个严格的限制：**新添加的枚举值必须在提交后才能使用**。

错误信息：
```
ERROR: 55P04: unsafe use of new value "manager" of enum type app_role
HINT: New enum values must be committed before they can be used.
```

## ✅ 解决方案

### 方案 1: 分步执行（推荐）

**步骤 1**: 添加枚举值
```bash
psql -d your_database -f scripts/step1_add_enum.sql
```

**步骤 2**: 创建角色数据
```bash
psql -d your_database -f scripts/step2_create_role_data.sql
```

### 方案 2: 手动执行

**步骤 1**: 添加枚举值
```sql
SELECT add_enum_value('app_role', 'manager');
```

**步骤 2**: 等待几秒钟，然后创建权限模板
```sql
INSERT INTO public.role_permission_templates (
    role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions,
    created_at,
    updated_at
) VALUES (
    'manager'::app_role,
    ARRAY['dashboard', 'dashboard.project', 'maintenance', 'maintenance.projects'],
    ARRAY['data', 'data.create', 'data.edit', 'data.export'],
    ARRAY['project_access', 'project.view_all', 'project.manage'],
    ARRAY['data_scope', 'data.team'],
    NOW(),
    NOW()
);
```

## 🔧 为什么会出现这个问题？

1. **PostgreSQL 事务限制**: 枚举值添加是 DDL 操作，需要立即提交
2. **类型检查**: PostgreSQL 在事务中严格检查类型匹配
3. **安全考虑**: 防止在事务中使用未确认的枚举值

## 🎯 最佳实践

### 1. 分步执行
- 先添加枚举值
- 等待提交
- 再使用新枚举值

### 2. 使用 ON CONFLICT
```sql
INSERT INTO table (role) VALUES ('manager'::app_role)
ON CONFLICT (role) DO NOTHING;
```

### 3. 检查枚举值存在
```sql
SELECT check_enum_value('app_role', 'manager');
```

## 🚀 测试验证

执行完成后，验证角色创建：

```sql
-- 检查枚举值
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumlabel;

-- 检查权限模板
SELECT role, array_length(menu_permissions, 1) as menu_count
FROM role_permission_templates 
WHERE role = 'manager'::app_role;

-- 检查项目分配
SELECT COUNT(*) as project_count
FROM user_projects 
WHERE role = 'manager'::app_role;
```

## ⚠️ 注意事项

1. **不要在同一事务中使用新枚举值**
2. **确保枚举值已提交**
3. **使用显式类型转换** `'manager'::app_role`
4. **添加错误处理** `ON CONFLICT DO NOTHING`

## 🎉 成功标志

看到以下输出表示成功：
```
Supported roles in system: admin, business, finance, manager, operator, partner, viewer
```