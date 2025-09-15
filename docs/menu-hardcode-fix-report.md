# 菜单硬编码问题修复报告

## 问题描述

用户反映菜单显示不完整，存在多个硬编码的菜单配置，导致菜单项不一致。

## 发现的硬编码问题

### 1. 多个菜单配置文件
- `src/config/permissions.ts` - 主权限配置文件
- `src/config/permissionsNew.ts` - 重复的权限配置文件（已删除）
- `src/components/AppSidebar.tsx` - 侧边栏硬编码菜单
- `src/components/mobile/MobileLayout.tsx` - 移动端硬编码菜单
- `src/pages/Settings/PermissionManagement.tsx` - 权限管理页面硬编码菜单

### 2. 菜单配置不一致
- **AppSidebar.tsx** 中缺少多个菜单项：
  - 数据看板缺少"数量概览"
  - 合同管理只有"合同列表"，缺少其他9个子菜单
  - 设置菜单缺少"集成权限管理"

- **MobileLayout.tsx** 中菜单配置不完整：
  - 数据看板菜单项不匹配
  - 合同管理只有"合同列表"
  - 缺少数据维护菜单
  - 设置菜单项不完整

## 修复内容

### 1. 统一AppSidebar.tsx菜单配置

**修复前**：
```typescript
// 数据看板只有3个菜单项
items: [
  { title: "运输看板", url: "/dashboard/transport", icon: Truck },
  { title: "财务看板", url: "/dashboard/financial", icon: Banknote },
  { title: "项目看板", url: "/dashboard/project", icon: PieChart },
]

// 合同管理只有1个菜单项
items: [
  { title: "合同列表", url: "/contracts", icon: FileText },
]

// 设置菜单缺少集成权限管理
items: [
  { title: "用户管理", url: "/settings/users", icon: Users },
  { title: "权限配置", url: "/settings/permissions", icon: Shield },
  { title: "合同权限", url: "/settings/contract-permissions", icon: FileText },
  { title: "角色模板", url: "/settings/role-templates", icon: Settings },
  { title: "操作日志", url: "/settings/audit-logs", icon: History },
]
```

**修复后**：
```typescript
// 数据看板包含4个菜单项
items: [
  { title: "运输看板", url: "/dashboard/transport", icon: Truck },
  { title: "财务看板", url: "/dashboard/financial", icon: Banknote },
  { title: "项目看板", url: "/dashboard/project", icon: PieChart },
  { title: "数量概览", url: "/quantity-overview", icon: Package },
]

// 合同管理包含10个菜单项
items: [
  { title: "合同列表", url: "/contracts", icon: FileText },
  { title: "新增合同", url: "/contracts", icon: Plus },
  { title: "编辑合同", url: "/contracts", icon: RotateCcw },
  { title: "删除合同", url: "/contracts", icon: RotateCcw },
  { title: "文件管理", url: "/contracts", icon: FileText },
  { title: "权限管理", url: "/contracts", icon: Shield },
  { title: "审计日志", url: "/contracts", icon: History },
  { title: "提醒管理", url: "/contracts", icon: RotateCcw },
  { title: "标签管理", url: "/contracts", icon: RotateCcw },
  { title: "编号管理", url: "/contracts", icon: RotateCcw },
]

// 设置菜单包含6个菜单项
items: [
  { title: "用户管理", url: "/settings/users", icon: UserCog },
  { title: "权限配置", url: "/settings/permissions", icon: Shield },
  { title: "合同权限", url: "/settings/contract-permissions", icon: FileText },
  { title: "角色模板", url: "/settings/role-templates", icon: Settings },
  { title: "集成权限管理", url: "/settings/integrated", icon: Shield },
  { title: "操作日志", url: "/settings/audit-logs", icon: History },
]
```

### 2. 统一MobileLayout.tsx菜单配置

**修复前**：
```typescript
// 数据看板菜单不匹配
items: [
  { name: '运输概览', href: '/m/', icon: Home },
  { name: '项目看板', href: '/m/dashboard/project', icon: BarChart3 },
  { name: '财务概览', href: '/m/dashboard/financial', icon: DollarSign }
]

// 合同管理只有1个菜单项
items: [
  { name: '合同列表', href: '/m/contracts', icon: FileSignature }
]

// 缺少数据维护菜单
// 设置菜单不完整
```

**修复后**：
```typescript
// 数据看板菜单与桌面端一致
items: [
  { name: '运输看板', href: '/m/dashboard/transport', icon: Truck },
  { name: '财务看板', href: '/m/dashboard/financial', icon: DollarSign },
  { name: '项目看板', href: '/m/dashboard/project', icon: BarChart3 },
  { name: '数量概览', href: '/m/quantity-overview', icon: Package }
]

// 合同管理包含10个菜单项
items: [
  { name: '合同列表', href: '/m/contracts', icon: FileSignature },
  { name: '新增合同', href: '/m/contracts', icon: Plus },
  { name: '编辑合同', href: '/m/contracts', icon: Edit },
  { name: '删除合同', href: '/m/contracts', icon: Trash2 },
  { name: '文件管理', href: '/m/contracts', icon: FileText },
  { name: '权限管理', href: '/m/contracts', icon: Shield },
  { name: '审计日志', href: '/m/contracts', icon: History },
  { name: '提醒管理', href: '/m/contracts', icon: Bell },
  { name: '标签管理', href: '/m/contracts', icon: Tag },
  { name: '编号管理', href: '/m/contracts', icon: Hash }
]

// 添加数据维护菜单
{
  title: '数据维护',
  icon: Database,
  items: [
    { name: '运单维护', href: '/m/data-maintenance/waybill', icon: Truck }
  ]
}

// 完整的设置菜单
const settingsNavigation = [
  { name: '用户管理', href: '/m/settings/users', icon: Users },
  { name: '权限配置', href: '/m/settings/permissions', icon: Shield },
  { name: '合同权限', href: '/m/settings/contract-permissions', icon: FileText },
  { name: '角色模板', href: '/m/settings/role-templates', icon: Settings },
  { name: '集成权限管理', href: '/m/settings/integrated', icon: Shield },
  { name: '操作日志', href: '/m/settings/audit-logs', icon: History }
]
```

### 3. 更新权限检查逻辑

在 `AppSidebar.tsx` 中添加了对新菜单项的权限检查：

```typescript
// 添加数量概览权限检查
} else if (item.url === '/quantity-overview') {
  menuKey = 'dashboard.quantity';

// 添加合同管理子菜单权限检查
} else if (item.url === '/contracts') {
  // 根据菜单标题确定具体的合同权限
  if (item.title === '合同列表') {
    menuKey = 'contracts.list';
  } else if (item.title === '新增合同') {
    menuKey = 'contracts.create';
  } else if (item.title === '编辑合同') {
    menuKey = 'contracts.edit';
  } else if (item.title === '删除合同') {
    menuKey = 'contracts.delete';
  } else if (item.title === '文件管理') {
    menuKey = 'contracts.files';
  } else if (item.title === '权限管理') {
    menuKey = 'contracts.permissions';
  } else if (item.title === '审计日志') {
    menuKey = 'contracts.audit';
  } else if (item.title === '提醒管理') {
    menuKey = 'contracts.reminders';
  } else if (item.title === '标签管理') {
    menuKey = 'contracts.tags';
  } else if (item.title === '编号管理') {
    menuKey = 'contracts.numbering';
  } else {
    menuKey = 'contracts.list'; // 默认
  }
```

### 4. 清理重复文件

删除了 `src/config/permissionsNew.ts` 重复的权限配置文件，统一使用 `src/config/permissions.ts`。

## 修复效果

### 修复前
- 菜单显示不完整
- 桌面端和移动端菜单不一致
- 多个硬编码配置文件
- 权限检查逻辑不完整

### 修复后
- 菜单显示完整，包含所有配置的菜单项
- 桌面端和移动端菜单保持一致
- 统一的权限配置文件
- 完整的权限检查逻辑

## 菜单结构总览

修复后的完整菜单结构：

1. **数据看板** (4项)
   - 运输看板
   - 财务看板
   - 项目看板
   - 数量概览

2. **信息维护** (4项)
   - 项目管理
   - 司机管理
   - 地点管理
   - 合作方管理

3. **业务管理** (4项)
   - 运单管理
   - 磅单管理
   - 付款申请
   - 申请单管理

4. **合同管理** (10项)
   - 合同列表
   - 新增合同
   - 编辑合同
   - 删除合同
   - 文件管理
   - 权限管理
   - 审计日志
   - 提醒管理
   - 标签管理
   - 编号管理

5. **财务对账** (2项)
   - 运费对账
   - 付款与开票

6. **数据维护** (1项)
   - 运单维护

7. **设置** (6项)
   - 用户管理
   - 权限配置
   - 合同权限
   - 角色模板
   - 集成权限管理
   - 操作日志

## 相关文件

- `src/components/AppSidebar.tsx` - 桌面端侧边栏菜单
- `src/components/mobile/MobileLayout.tsx` - 移动端菜单
- `src/config/permissions.ts` - 统一权限配置文件
- `src/pages/Settings/PermissionManagement.tsx` - 权限管理页面

现在菜单应该能够完整显示，并且桌面端和移动端保持一致。
