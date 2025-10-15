// 动态权限配置 - 与现有权限系统兼容
// 文件: src/config/dynamicPermissions.ts
import { 
  BarChart3, 
  Database, 
  FileText, 
  Calculator,
  PieChart,
  Banknote,
  Truck,
  Package,
  MapPin,
  Users,
  Plus,
  ClipboardList,
  Settings,
  Weight,
  Shield,
  History
} from "lucide-react";

// 菜单配置 - 与AppSidebar.tsx保持一致
export const menuItems = [
  {
    title: "数据看板",
    icon: BarChart3,
    items: [
      { title: "运输看板", url: "/dashboard/transport", icon: Truck },
      { title: "财务看板", url: "/dashboard/financial", icon: Banknote },
      { title: "项目看板", url: "/dashboard/project", icon: PieChart },
    ]
  },
  {
    title: "合同管理",
    icon: FileText,
    items: [
      { title: "合同列表", url: "/contracts", icon: FileText },
    ]
  },
  {
    title: "信息维护",
    icon: Database,
    items: [
      { title: "项目管理", url: "/projects", icon: Package },
      { title: "司机管理", url: "/drivers", icon: Truck },
      { title: "地点管理", url: "/locations", icon: MapPin },
      { title: "📍 地点管理（增强版）", url: "/locations-enhanced", icon: MapPin },
      { title: "合作方管理", url: "/partners", icon: Users },
    ]
  },
  {
    title: "业务管理",
    icon: FileText,
    items: [
      { title: "运单管理", url: "/business-entry", icon: Plus },
      { title: "磅单管理", url: "/scale-records", icon: Weight },
      { title: "开票申请", url: "/invoice-request", icon: FileText },
      { title: "付款申请", url: "/payment-request", icon: Banknote },
    ]
  },
  {
    title: "财务管理",
    icon: Calculator,
    items: [
      { title: "运费对账", url: "/finance/reconciliation", icon: Calculator },
      { title: "付款与开票", url: "/finance/payment-invoice", icon: Banknote },
      { title: "开票申请单管理", url: "/invoice-request-management", icon: FileText },
      { title: "付款申请单管理", url: "/payment-requests-list", icon: ClipboardList },
    ]
  },
  {
    title: "数据维护",
    icon: Database,
    items: [
      { title: "运单维护", url: "/data-maintenance/waybill", icon: Truck },
      { title: "运单维护（增强版）", url: "/data-maintenance/waybill-enhanced", icon: Truck },
    ]
  },
  {
    title: "设置",
    icon: Settings,
    items: [
      { title: "用户管理", url: "/settings/users", icon: Users },
      { title: "权限配置", url: "/settings/permissions", icon: Shield },
      { title: "合同权限", url: "/settings/contract-permissions", icon: FileText },
      { title: "角色模板", url: "/settings/role-templates", icon: Shield },
      { title: "权限管理", url: "/settings/permission-management", icon: Shield },
    ]
  }
];

// URL到权限键的映射
const urlToPermissionKey: Record<string, string> = {
  // 数据看板
  '/dashboard/transport': 'dashboard.transport',
  '/dashboard/financial': 'dashboard.financial',
  '/dashboard/project': 'dashboard.project',
  
  // 合同管理
  '/contracts': 'contracts.list',
  
  // 信息维护
  '/projects': 'maintenance.projects',
  '/drivers': 'maintenance.drivers',
  '/locations': 'maintenance.locations',
  '/locations-enhanced': 'maintenance.locations_enhanced',
  '/partners': 'maintenance.partners',
  
  // 业务管理
  '/business-entry': 'business.entry',
  '/scale-records': 'business.scale',
  '/invoice-request': 'business.invoice_request',
  '/payment-request': 'business.payment_request',
  
  // 财务管理
  '/finance/reconciliation': 'finance.reconciliation',
  '/finance/payment-invoice': 'finance.payment_invoice',
  '/invoice-request-management': 'finance.invoice_request_management',
  '/payment-requests-list': 'finance.payment_requests',
  
  // 数据维护
  '/data-maintenance/waybill': 'data_maintenance.waybill',
  '/data-maintenance/waybill-enhanced': 'data_maintenance.waybill_enhanced',
  
  // 设置
  '/settings/users': 'settings.users',
  '/settings/permissions': 'settings.permissions',
  '/settings/contract-permissions': 'settings.contract_permissions',
  '/settings/role-templates': 'settings.role_templates',
  '/settings/permission-management': 'settings.permission_management',
};

// 菜单权限项接口
interface MenuPermissionItem {
  key: string;
  label: string;
  url: string;
}

// 菜单权限组接口
interface MenuPermissionGroup {
  group: string;
  permissions: MenuPermissionItem[];
}

// 从现有菜单结构生成权限配置（与现有权限系统兼容）
export function generateMenuPermissions(): MenuPermissionGroup[] {
  // 使用与 src/config/permissions.ts 相同的结构
  return menuItems.map(group => ({
    group: group.title,
    permissions: group.items.map(item => ({
      key: urlToPermissionKey[item.url] || item.url.replace('/', '').replace('/', '.'),
      label: item.title.replace('📍 ', ''), // 移除特殊标记
      url: item.url
    }))
  }));
}

// 静态菜单权限配置（作为回退方案）
function generateStaticMenuPermissions() {
  return menuItems.map(group => ({
    group: group.title,
    permissions: group.items.map(item => ({
      key: urlToPermissionKey[item.url] || item.url.replace('/', '').replace('/', '.'),
      label: item.title.replace('📍 ', ''), // 移除特殊标记
      url: item.url
    }))
  }));
}

// 功能权限定义（保持原有结构）
export const FUNCTION_PERMISSIONS = [
  {
    group: '数据操作',
    permissions: [
      { key: 'data.create', label: '新增数据' },
      { key: 'data.edit', label: '编辑数据' },
      { key: 'data.delete', label: '删除数据' },
      { key: 'data.export', label: '导出数据' },
      { key: 'data.import', label: '导入数据' }
    ]
  },
  {
    group: '磅单管理',
    permissions: [
      { key: 'scale_records.create', label: '新增磅单' },
      { key: 'scale_records.edit', label: '编辑磅单' },
      { key: 'scale_records.view', label: '查看磅单' },
      { key: 'scale_records.delete', label: '删除磅单' }
    ]
  },
  {
    group: '财务操作',
    permissions: [
      { key: 'finance.view_cost', label: '查看成本信息' },
      { key: 'finance.approve_payment', label: '审批付款' },
      { key: 'finance.generate_invoice', label: '生成发票' },
      { key: 'finance.reconcile', label: '财务对账' }
    ]
  },
  {
    group: '系统管理',
    permissions: [
      { key: 'system.manage_users', label: '管理用户' },
      { key: 'system.manage_roles', label: '管理角色' },
      { key: 'system.view_logs', label: '查看日志' },
      { key: 'system.backup', label: '系统备份' }
    ]
  }
];

// 获取所有菜单权限键
export function getAllMenuPermissionKeys(): string[] {
  const permissions = generateMenuPermissions();
  return permissions.flatMap(group => 
    group.permissions.map(permission => permission.key)
  );
}

// 根据URL获取权限键
export function getPermissionKeyByUrl(url: string): string | null {
  return urlToPermissionKey[url] || null;
}

// 根据权限键获取菜单信息
export function getMenuInfoByPermissionKey(key: string): { title: string; url: string; group: string } | null {
  const permissions = generateMenuPermissions();
  
  for (const group of permissions) {
    for (const permission of group.permissions) {
      if (permission.key === key) {
        return {
          title: permission.label,
          url: permission.url,
          group: group.group
        };
      }
    }
  }
  
  return null;
}
