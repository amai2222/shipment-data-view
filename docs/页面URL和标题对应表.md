# 页面URL和标题对应表

## 📊 完整映射关系

### 数据看板分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/` 或 `/home` | `Home.tsx` | 运输看板 | 运输看板 |
| `/dashboard` | `Dashboard.tsx` | 数据看板 | （未在菜单） |
| `/dashboard/transport` | ? | ? | 运输看板 |
| `/dashboard/financial` | `FinancialOverview.tsx` | 财务看板 | 财务看板 |
| `/dashboard/project` | `ProjectDashboard.tsx` | 项目看板 | 项目看板 |
| `/dashboard/shipper` | `ShipperDashboard.tsx` | ? | 货主看板 |

### 合同管理分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/contracts` | `ContractManagement.tsx` | ? | 合同列表 |

### 信息维护分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/projects` | `Projects.tsx` | 项目管理 | 项目管理 |
| `/drivers` | `Drivers.tsx` | 司机管理 | 司机管理 |
| `/locations` | `Locations.tsx` | 地点管理 | 地点管理 |
| `/locations-enhanced` | `EnhancedLocations.tsx` | ? | 地点管理（增强版） |
| `/partners` | `Partners.tsx` | ? | 合作方管理 |
| `/partners/hierarchy` | `PartnerHierarchyManagement.tsx` | ? | 货主层级管理 |

### 业务管理分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/business-entry` | `BusinessEntry/index.tsx` | ? | 运单管理 |
| `/scale-records` | `ScaleRecords/index.tsx` | ? | 磅单管理 |
| `/invoice-request` | `InvoiceRequest.tsx` | ? | 开票申请 |
| `/payment-request` | `PaymentRequest.tsx` | ? | 付款申请 |

### 财务管理分组

| URL | 文件 | 页面实际标题 | 菜单显示名称 |
|-----|------|------------|------------|
| `/finance/reconciliation` | `FinanceReconciliation.tsx` | **运费对账** | 对账管理 |
| `/finance/payment-invoice` | `PaymentInvoice.tsx` | **财务收款** | 付款开票 |
| `/payment-requests-list` | `PaymentRequestsList.tsx` | ? | 付款申请列表 |
| `/invoice-request-management` | `InvoiceRequestManagement.tsx` | ? | 开票申请管理 |

### 审核管理分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/audit/invoice` | `InvoiceAudit.tsx` | 开票审核 | 开票审核 |
| `/audit/payment` | `PaymentAudit.tsx` | ? | 付款审核 |

### 数据维护分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/data-maintenance/waybill` | `WaybillMaintenance.tsx` | 运单维护 | 运单数据维护 |
| `/data-maintenance/waybill-enhanced` | `EnhancedWaybillMaintenance.tsx` | ? | 运单维护（增强版） |

### 系统设置分组

| URL | 文件 | 页面标题 | 菜单显示 |
|-----|------|----------|----------|
| `/settings/users` | `Settings/UserManagement.tsx` | ? | 用户管理 |
| `/settings/permissions` | `Settings/PermissionConfig.tsx` | ? | 权限配置 |
| `/settings/contract-permissions` | `Settings/ContractPermission.tsx` | ? | 合同权限管理 |
| `/settings/role-templates` | `Settings/RoleTemplate.tsx` | ? | 角色模板 |
| `/settings/integrated` | `IntegratedUserManagement.tsx` | ? | 集成权限管理 |
| `/settings/audit-logs` | `Settings/AuditLogs.tsx` | ? | 操作日志 |
| `/settings/menu-config` | `Settings/MenuConfig.tsx` | 菜单配置管理 | 菜单配置 |
| `/settings/backup` | `Settings/SystemBackup.tsx` | 系统备份 | 系统备份 |

---

## ❓ 需要您确认的页面

标记为 `?` 的页面需要您确认实际标题，我会去检查并补充完整。

**请告诉我是否需要我逐个检查所有带 `?` 的页面标题？** 🔍

