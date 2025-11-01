// 路由权限映射配置
// 将路由路径映射到所需的菜单权限

export const routePermissionMap: Record<string, string> = {
  // 数据看板
  '/': 'dashboard.transport',
  '/home': 'dashboard.transport',
  '/dashboard/transport': 'dashboard.transport',
  '/dashboard/financial': 'dashboard.financial',
  '/dashboard/project': 'dashboard.project',
  '/dashboard/shipper': 'dashboard.shipper',
  '/project/:projectId': 'dashboard.project',
  
  // 合同管理
  '/contracts': 'contracts.list',
  
  // 信息维护
  '/projects': 'maintenance.projects',
  '/drivers': 'maintenance.drivers',
  '/locations': 'maintenance.locations',
  '/locations-enhanced': 'maintenance.locations_enhanced',
  '/partners': 'maintenance.partners',
  '/partners/hierarchy': 'maintenance.partners',
  
  // 业务管理
  '/business-entry': 'business.entry',
  '/scale-records': 'business.scale',
  '/payment-request': 'business.payment_request',
  '/invoice-request': 'business.invoice_request',
  
  // 审核管理
  '/audit/invoice': 'audit.invoice',
  '/audit/payment': 'audit.payment',
  
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
  '/settings/integrated': 'settings.integrated',
  '/settings/audit-logs': 'settings.audit_logs',
  
  // 移动端（保持一致）
  '/m/home': 'dashboard.transport',
  '/m/dashboard/transport': 'dashboard.transport',
  '/m/dashboard/financial': 'dashboard.financial',
  '/m/projects': 'maintenance.projects',
  '/m/drivers': 'maintenance.drivers',
  '/m/partners': 'maintenance.partners',
  '/m/business-entry': 'business.entry',
  '/m/payment-requests': 'finance.payment_requests',
  '/m/invoice-requests': 'finance.invoice_request_management',
  '/m/settings': 'settings',
  '/m/settings/users': 'settings.users',
  '/m/settings/permissions': 'settings.permissions',
  '/m/settings/contract-permissions': 'settings.contract_permissions',
  '/m/settings/role-templates': 'settings.role_templates',
  '/m/settings/audit-logs': 'settings.audit_logs',
};

// 获取路由所需权限
export function getRoutePermission(pathname: string): string | null {
  // 精确匹配
  if (routePermissionMap[pathname]) {
    return routePermissionMap[pathname];
  }
  
  // 模糊匹配（处理动态路由）
  for (const [pattern, permission] of Object.entries(routePermissionMap)) {
    if (pattern.includes(':')) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(pathname)) {
        return permission;
      }
    }
  }
  
  return null;
}

