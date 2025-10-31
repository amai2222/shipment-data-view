# 信息维护页面组件化重构计划

## 重构范围
信息维护菜单下的5个页面：
1. ✅ **Projects.tsx** (44KB, 1000+行) - 项目管理
2. ⏳ **Drivers.tsx** (43KB, 1000+行) - 司机管理
3. ⏳ **Locations.tsx** (19KB, 500+行) - 地点管理
4. ⏳ **EnhancedLocations.tsx** (36KB, 800+行) - 地点管理增强版
5. ⏳ **Partners.tsx** (26KB, 600+行) - 合作方管理

**总代码量：~168KB, 约4000+行代码**

## 已备份文件
- ✅ Projects.backup-20251031-132919.tsx
- ✅ Drivers.backup-20251031-132919.tsx
- ✅ Locations.backup-20251031-132919.tsx
- ✅ EnhancedLocations.backup-20251031-132919.tsx
- ✅ Partners.backup-20251031-132919.tsx

## Projects.tsx 重构方案

### 当前结构分析
```typescript
// 主要功能：
1. 项目列表展示（Table with expand/collapse）
2. 项目添加/编辑表单（Dialog with 多步骤）
3. 合作链路配置（PartnerSelector组件）
4. 搜索、筛选、排序功能
5. 删除确认对话框
6. React Query 数据缓存
7. 合作方数据联动

// 关键状态：
- expandedProject: 展开的项目ID
- isDialogOpen: 表单对话框状态
- editingProject: 正在编辑的项目
- formData: 表单数据
- selectedChains: 选中的合作链路
- searchQuery, statusFilter, sortBy: 筛选排序状态
```

### 重构后的文件结构
```
src/pages/
├── Projects.tsx (重构后的主文件，~100行)
└── Maintenance/
    ├── hooks/
    │   ├── useProjectsData.ts ✅ (数据获取、缓存、删除)
    │   ├── useProjectForm.ts (表单状态管理)
    │   └── useProjectFilters.ts (筛选排序逻辑)
    └── components/
        ├── PartnerChainDisplay.tsx (合作链路展示)
        ├── ProjectFilters.tsx (搜索、筛选、排序工具栏)
        ├── ProjectTable.tsx (项目列表表格)
        ├── ProjectRow.tsx (单个项目行，含展开)
        ├── ProjectForm.tsx (项目表单)
        └── ProjectFormDialog.tsx (表单对话框容器)
```

### 需要保留的核心功能
1. ✅ 所有表单字段（11个字段）
2. ✅ 合作链路配置（多链路、多级合作方）
3. ✅ 搜索功能（项目名、负责人、地址）
4. ✅ 状态筛选（进行中、已暂停、已完成、已取消）
5. ✅ 排序（按状态、按日期）
6. ✅ 展开/折叠项目详情
7. ✅ 编辑和删除功能
8. ✅ React Query 缓存优化
9. ✅ 响应式布局

### 关键技术点
- React Query 用于数据缓存和刷新
- PartnerSelector 组件复用
- Dialog 表单交互
- Table 展开/折叠交互
- 筛选和排序逻辑

## 估算工作量

| 页面 | 代码量 | 复杂度 | 预计组件数 | 预计时间 |
|------|--------|--------|-----------|---------|
| Projects.tsx | 44KB | ⭐⭐⭐⭐⭐ | 8个 | 2-3小时 |
| Drivers.tsx | 43KB | ⭐⭐⭐⭐ | 7个 | 2-3小时 |
| Locations.tsx | 19KB | ⭐⭐⭐ | 5个 | 1-2小时 |
| EnhancedLocations.tsx | 36KB | ⭐⭐⭐⭐ | 6个 | 2小时 |
| Partners.tsx | 26KB | ⭐⭐⭐ | 6个 | 1-2小时 |
| **总计** | **168KB** | - | **32个** | **8-12小时** |

## 重构策略

### 阶段一：创建基础架构 ✅
- [x] 创建目录结构
- [x] 创建 useProjectsData hook

### 阶段二：Projects.tsx 完整重构 (进行中)
1. ✅ 创建 useProjectsData.ts
2. ⏳ 创建 useProjectForm.ts
3. ⏳ 创建 useProjectFilters.ts
4. ⏳ 创建 PartnerChainDisplay.tsx
5. ⏳ 创建 ProjectFilters.tsx
6. ⏳ 创建 ProjectTable.tsx
7. ⏳ 创建 ProjectRow.tsx
8. ⏳ 创建 ProjectForm.tsx
9. ⏳ 创建 ProjectFormDialog.tsx
10. ⏳ 重构主文件 Projects.tsx
11. ⏳ 测试所有功能

### 阶段三：其他页面重构
- Drivers.tsx
- Locations.tsx
- EnhancedLocations.tsx
- Partners.tsx

## 建议

鉴于重构工作量较大（预计8-12小时），建议：

### 选项1：分批重构（推荐）
1. **先完成数据看板重构验证** ✅ 已完成
   - 测试功能完整性
   - 确认重构方法可行

2. **然后分批重构信息维护页面**
   - 第一批：Projects.tsx + Drivers.tsx (最复杂)
   - 第二批：Partners.tsx + Locations.tsx
   - 第三批：EnhancedLocations.tsx

### 选项2：先重点优化（推荐）
只重构最常用和最复杂的页面：
1. **Projects.tsx** - 最常用，最复杂
2. **Drivers.tsx** - 使用频繁
3. 其他页面可以后续优化

### 选项3：继续全部重构
继续完成所有5个页面的重构

## 当前状态

### 已完成 ✅
1. 备份所有5个页面
2. 创建 useProjectsData hook
3. 分析 Projects.tsx 结构

### 进行中 ⏳
1. Projects.tsx 组件化重构

### 待完成 ⏸️
1. Projects.tsx 其余8个组件
2. Drivers.tsx 完整重构
3. Locations.tsx 完整重构
4. EnhancedLocations.tsx 完整重构
5. Partners.tsx 完整重构

## 建议下一步

鉴于工作量，建议您先：
1. **测试数据看板重构效果** - 确认重构方法可行
2. **决定重构优先级** - 是否需要全部重构或分批进行
3. **提供反馈** - 根据数据看板的效果调整策略

我可以：
- 继续完成 Projects.tsx 的完整重构
- 或先暂停，等您测试数据看板后再继续
- 或调整重构范围，只重构核心页面

请告诉我您的选择！

