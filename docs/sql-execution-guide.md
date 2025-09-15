# 项目状态自动权限分配 - SQL 执行指南

## 📋 需要执行的 SQL 文件

### 1. **项目状态自动分配触发器** ⭐ 必须执行
**文件**: `scripts/project_status_auto_assign.sql`
**作用**: 创建数据库触发器，当项目状态变更为"进行中"时自动为所有用户分配访问权限

```bash
psql -h localhost -p 54322 -U postgres -d postgres -f scripts/project_status_auto_assign.sql
```

**功能**:
- ✅ 创建 `handle_project_status_change()` 触发器函数
- ✅ 创建 `project_status_change_trigger` 触发器
- ✅ 为现有"进行中"项目分配权限
- ✅ 验证触发器创建和分配结果

### 2. **初始化项目分配权限** ⭐ 必须执行
**文件**: `scripts/initialize_project_assignments.sql`
**作用**: 确保所有用户都有所有项目的默认访问权限

```bash
psql -h localhost -p 54322 -U postgres -d postgres -f scripts/initialize_project_assignments.sql
```

**功能**:
- ✅ 检查当前项目分配状态
- ✅ 为所有用户分配所有项目（默认权限）
- ✅ 验证分配结果
- ✅ 显示分配统计

## 🔄 执行顺序

### 步骤 1: 执行触发器创建
```bash
# 创建项目状态变更触发器
psql -h localhost -p 54322 -U postgres -d postgres -f scripts/project_status_auto_assign.sql
```

### 步骤 2: 执行权限初始化
```bash
# 初始化所有用户的项目分配权限
psql -h localhost -p 54322 -U postgres -d postgres -f scripts/initialize_project_assignments.sql
```

## 📊 执行后验证

### 1. 检查触发器是否创建成功
```sql
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'project_status_change_trigger';
```

### 2. 检查项目分配统计
```sql
SELECT 
    p.name as project_name,
    p.project_status,
    COUNT(up.user_id) as assigned_users,
    COUNT(pr.id) as total_users
FROM public.projects p
LEFT JOIN public.user_projects up ON p.id = up.project_id
LEFT JOIN public.profiles pr ON pr.is_active = true
WHERE p.project_status = '进行中'
GROUP BY p.id, p.name, p.project_status
ORDER BY p.name;
```

### 3. 检查用户项目分配
```sql
SELECT 
    p.full_name as user_name,
    p.role as user_role,
    COUNT(up.project_id) as assigned_projects,
    COUNT(pr.id) as total_projects
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
LEFT JOIN public.projects pr ON up.project_id = pr.id
GROUP BY p.id, p.full_name, p.role
ORDER BY p.full_name;
```

## ⚠️ 重要说明

### 1. **执行顺序很重要**
- 必须先执行 `project_status_auto_assign.sql` 创建触发器
- 再执行 `initialize_project_assignments.sql` 初始化权限

### 2. **触发器功能**
- 当项目状态变更为"进行中"时，自动为所有用户分配访问权限
- 默认角色为 `operator`，权限为：`can_view=true`, `can_edit=true`, `can_delete=false`

### 3. **权限分配逻辑**
- 默认情况下，所有用户都具有所有项目的访问权限
- 取消勾选项目将限制用户访问该项目
- 项目状态变更为"进行中"时，自动分配权限给所有用户

## 🎯 执行完成后

执行完成后，您的前端项目状态管理功能将完全可用：

1. ✅ **自动权限分配**: 项目状态变更时自动分配权限
2. ✅ **批量操作**: 支持批量更新项目状态
3. ✅ **权限管理**: 完整的项目权限分配界面
4. ✅ **状态监控**: 实时监控项目状态变更

## 🚀 测试建议

执行 SQL 后，建议测试以下功能：

1. **创建新项目** → 设置为"进行中" → 检查是否自动分配权限
2. **修改项目状态** → 从"未开始"改为"进行中" → 检查是否自动分配权限
3. **批量更新状态** → 使用前端批量功能 → 检查权限分配
4. **权限管理界面** → 检查项目分配是否正确显示

---

**注意**: 请确保在 Supabase 控制台中执行这些 SQL 命令，或者使用正确的数据库连接参数。
