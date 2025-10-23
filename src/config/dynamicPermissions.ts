// 动态权限配置 - 与现有权限系统兼容
// 文件: src/config/dynamicPermissions.ts

// 从AppSidebar.tsx导入菜单配置
import { menuItems } from '@/components/AppSidebar';

// URL到权限键的映射
const urlToPermissionKey: Record<string, string> = {
  // 数据看板
  '/dashboard/transport': 'dashboard.transport',
  '/dashboard/financial': 'dashboard.financial',
  '/dashboard/project': 'dashboard.project',
  '/dashboard/shipper': 'dashboard.shipper',
  
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
