# 项目状态自动权限分配功能

## 🎯 功能描述

当项目状态变更为"进行中"时，系统会自动为所有用户分配该项目的访问权限。

## 🔧 实现方案

### 1. **数据库触发器**（自动执行）

**文件**：`scripts/project_status_auto_assign.sql`

**功能**：
- 监听 `projects` 表的 `project_status` 字段更新
- 当状态变更为"进行中"时，自动为所有活跃用户分配权限
- 使用 `upsert` 避免重复分配

**触发器逻辑**：
```sql
-- 检查项目状态是否变更为"进行中"
IF NEW.project_status = '进行中' AND OLD.project_status != '进行中' THEN
    -- 为所有用户分配该项目权限
    FOR user_record IN SELECT id FROM public.profiles WHERE is_active = true
    LOOP
        INSERT INTO public.user_projects (
            user_id, project_id, role, can_view, can_edit, can_delete
        ) VALUES (
            user_record.id, NEW.id, 'operator'::app_role, true, true, false
        );
    END LOOP;
END IF;
```

### 2. **前端服务**（手动调用）

**文件**：`src/services/ProjectStatusService.ts`

**功能**：
- 提供项目状态更新接口
- 状态变更为"进行中"时自动分配权限
- 支持批量状态更新

**核心方法**：
```typescript
// 更新项目状态
static async updateProjectStatus(projectId: string, newStatus: string): Promise<ProjectStatusChange>

// 为所有用户分配项目权限
private static async assignProjectToAllUsers(projectId: string): Promise<void>

// 批量更新项目状态
static async batchUpdateProjectStatus(projectIds: string[], newStatus: string): Promise<ProjectStatusChange[]>
```

### 3. **React Hook**（状态管理）

**文件**：`src/hooks/useProjectStatus.ts`

**功能**：
- 管理项目状态更新状态
- 提供用户友好的反馈
- 处理错误和成功消息

**使用示例**：
```typescript
const { updateProjectStatus, batchUpdateProjectStatus, updating } = useProjectStatus({
  onStatusChange: (change) => {
    console.log('状态变更:', change);
  }
});

// 更新单个项目状态
await updateProjectStatus(projectId, '进行中');

// 批量更新项目状态
await batchUpdateProjectStatus(projectIds, '进行中');
```

### 4. **UI 组件**（用户界面）

**文件**：`src/components/ProjectStatusManager.tsx`

**功能**：
- 提供项目状态管理界面
- 支持单个和批量状态更新
- 显示权限分配提示

**特性**：
- ✅ 状态选择器
- ✅ 批量操作
- ✅ 权限分配提示
- ✅ 加载状态显示

## 🚀 使用方法

### 1. **数据库设置**

执行触发器脚本：
```bash
psql -d your_database -f scripts/project_status_auto_assign.sql
```

### 2. **前端集成**

```typescript
import { ProjectStatusManager } from '@/components/ProjectStatusManager';
import { useProjectStatus } from '@/hooks/useProjectStatus';

// 在组件中使用
function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  
  return (
    <ProjectStatusManager 
      projects={projects}
      onProjectUpdate={() => {
        // 刷新项目列表
        loadProjects();
      }}
    />
  );
}
```

### 3. **服务调用**

```typescript
import { ProjectStatusService } from '@/services/ProjectStatusService';

// 更新项目状态
const change = await ProjectStatusService.updateProjectStatus(projectId, '进行中');

// 批量更新
const changes = await ProjectStatusService.batchUpdateProjectStatus(
  projectIds, 
  '进行中'
);
```

## 📋 权限分配规则

### 默认权限设置
- **角色**：`operator`（操作员）
- **查看权限**：`true`
- **编辑权限**：`true`
- **删除权限**：`false`

### 分配范围
- **目标用户**：所有 `is_active = true` 的用户
- **目标项目**：状态为"进行中"的项目
- **分配方式**：使用 `upsert` 避免重复

## 🔄 工作流程

### 1. **状态变更触发**
```
用户更新项目状态 → 数据库触发器 → 自动权限分配
```

### 2. **前端调用触发**
```
用户操作 → 前端服务 → 数据库更新 → 权限分配 → 用户反馈
```

### 3. **批量操作流程**
```
选择项目 → 选择新状态 → 批量更新 → 权限分配 → 结果反馈
```

## ⚠️ 注意事项

### 1. **权限分配时机**
- ✅ 仅在状态变更为"进行中"时分配
- ✅ 不会覆盖现有的权限设置
- ✅ 使用 `upsert` 避免重复分配

### 2. **性能考虑**
- ✅ 批量操作使用事务
- ✅ 权限分配使用批量插入
- ✅ 避免重复数据库查询

### 3. **错误处理**
- ✅ 数据库操作失败时回滚
- ✅ 前端操作失败时显示错误消息
- ✅ 权限分配失败时不影响状态更新

## 🎉 功能优势

### 1. **自动化**
- ✅ 无需手动分配权限
- ✅ 状态变更自动触发
- ✅ 减少人工操作

### 2. **一致性**
- ✅ 所有"进行中"项目都有权限分配
- ✅ 权限设置统一
- ✅ 避免遗漏

### 3. **用户体验**
- ✅ 操作简单直观
- ✅ 实时反馈
- ✅ 批量操作支持

现在项目状态变更为"进行中"时会自动为所有用户分配访问权限！🎉
