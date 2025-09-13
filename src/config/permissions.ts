// 权限管理配置文件

export interface MenuPermission {
  key: string;
  label: string;
  title: string;
  url?: string;
  icon: string;
  group: string;
  children?: MenuPermission[];
}

export interface FunctionPermission {
  key: string;
  label: string;
  title: string;
  description: string;
  group: string;
}

export interface ButtonPermission {
  key: string;
  label: string;
  title: string;
  description: string;
  group: string;
}

export interface ProjectPermission {
  key: string;
  label: string;
  title: string;
  description: string;
  group: string;
  projectId?: string;
}

// 所有角色类型定义
export type UserRole = 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer';

// 菜单权限配置
export const MENU_PERMISSIONS: MenuPermission[] = [
  {
    group: '数据看板',
    key: 'dashboard',
    label: '数据看板',
    title: '数据看板',
    icon: 'BarChart3',
    children: [
      { key: 'dashboard.transport', label: '运输看板', title: '运输看板', url: '/dashboard/transport', icon: 'Truck', group: '数据看板' },
      { key: 'dashboard.financial', label: '财务看板', title: '财务看板', url: '/dashboard/financial', icon: 'DollarSign', group: '数据看板' },
      { key: 'dashboard.project', label: '项目看板', title: '项目看板', url: '/dashboard/project', icon: 'PieChart', group: '数据看板' },
      { key: 'dashboard.quantity', label: '数量概览', title: '数量概览', url: '/quantity-overview', icon: 'Package', group: '数据看板' }
    ]
  },
  {
    group: '信息维护',
    key: 'maintenance',
    label: '信息维护',
    title: '信息维护',
    icon: 'Database',
    children: [
      { key: 'maintenance.projects', label: '项目管理', title: '项目管理', url: '/projects', icon: 'Package', group: '信息维护' },
      { key: 'maintenance.drivers', label: '司机管理', title: '司机管理', url: '/drivers', icon: 'Truck', group: '信息维护' },
      { key: 'maintenance.partners', label: '合作方管理', title: '合作方管理', url: '/partners', icon: 'Users', group: '信息维护' },
      { key: 'maintenance.locations', label: '地点管理', title: '地点管理', url: '/locations', icon: 'MapPin', group: '信息维护' }
    ]
  },
  {
    group: '业务录入',
    key: 'business',
    label: '业务录入',
    title: '业务录入',
    icon: 'FileText',
    children: [
      { key: 'business.entry', label: '运单录入', title: '运单录入', url: '/business-entry', icon: 'Plus', group: '业务录入' },
      { key: 'business.import', label: '数据导入', title: '数据导入', url: '/data-import', icon: 'Upload', group: '业务录入' },
      { key: 'business.maintenance', label: '运单维护', title: '运单维护', url: '/waybill-maintenance', icon: 'Edit', group: '业务录入' },
      { key: 'business.scale', label: '磅单管理', title: '磅单管理', url: '/scale-records', icon: 'Scale', group: '业务录入' }
    ]
  },
  {
    group: '财务管理',
    key: 'finance',
    label: '财务管理',
    title: '财务管理',
    icon: 'DollarSign',
    children: [
      { key: 'finance.reconciliation', label: '对账管理', title: '对账管理', url: '/finance-reconciliation', icon: 'Calculator', group: '财务管理' },
      { key: 'finance.payment_request', label: '付款申请', title: '付款申请', url: '/payment-request', icon: 'CreditCard', group: '财务管理' },
      { key: 'finance.payment_list', label: '付款申请列表', title: '付款申请列表', url: '/payment-requests-list', icon: 'List', group: '财务管理' },
      { key: 'finance.invoice', label: '发票管理', title: '发票管理', url: '/payment-invoice', icon: 'Receipt', group: '财务管理' },
      { key: 'finance.financial_overview', label: '财务汇总', title: '财务汇总', url: '/financial-overview', icon: 'TrendingUp', group: '财务管理' },
      { key: 'finance.transport_overview', label: '运输汇总', title: '运输汇总', url: '/transport-overview', icon: 'Truck', group: '财务管理' },
      { key: 'finance.projects_overview', label: '项目汇总', title: '项目汇总', url: '/projects-overview', icon: 'FolderOpen', group: '财务管理' },
      { key: 'finance.project_dashboard', label: '项目看板', title: '项目看板', url: '/project-dashboard', icon: 'BarChart', group: '财务管理' },
      { key: 'finance.payment_approval', label: '付款审批', title: '付款审批', url: '/payment-approval', icon: 'CheckSquare', group: '财务管理' },
      { key: 'finance.invoice_detail', label: '发票详情', title: '发票详情', url: '/payment-invoice-detail', icon: 'FileText', group: '财务管理' }
    ]
  },
  {
    group: '系统管理',
    key: 'system',
    label: '系统管理',
    title: '系统管理',
    icon: 'Settings',
    children: [
      { key: 'system.user_management', label: '用户管理', title: '用户管理', url: '/user-management', icon: 'Users', group: '系统管理' },
      { key: 'system.permission_management', label: '权限管理', title: '权限管理', url: '/permission-management', icon: 'Shield', group: '系统管理' }
    ]
  },
  {
    group: '合同管理',
    key: 'contract',
    label: '合同管理',
    title: '合同管理',
    icon: 'FileSignature',
    children: [
      { key: 'contract.management', label: '合同管理', title: '合同管理', url: '/contract-management', icon: 'FileText', group: '合同管理' }
    ]
  },
  {
    group: '审计日志',
    key: 'audit',
    label: '审计日志',
    title: '审计日志',
    icon: 'History',
    children: [
      { key: 'audit.logs', label: '审计日志', title: '审计日志', url: '/audit-logs', icon: 'FileSearch', group: '审计日志' },
      { key: 'audit.permission_debug', label: '权限调试', title: '权限调试', url: '/debug-permissions', icon: 'Bug', group: '审计日志' },
      { key: 'audit.integrated_user_management', label: '集成用户管理', title: '集成用户管理', url: '/integrated-user-management', icon: 'UserCog', group: '审计日志' },
      { key: 'audit.enhanced_permission_management', label: '增强权限管理', title: '增强权限管理', url: '/enhanced-permission-management', icon: 'ShieldCheck', group: '审计日志' }
    ]
  }
];

// 功能权限配置
export const FUNCTION_PERMISSIONS: FunctionPermission[] = [
  { key: 'create_project', label: '创建项目', title: '创建项目', description: '允许创建新项目', group: '项目管理' },
  { key: 'edit_project', label: '编辑项目', title: '编辑项目', description: '允许编辑现有项目', group: '项目管理' },
  { key: 'delete_project', label: '删除项目', title: '删除项目', description: '允许删除项目', group: '项目管理' },
  { key: 'view_project', label: '查看项目', title: '查看项目', description: '允许查看项目详情', group: '项目管理' },
  { key: 'manage_project_settings', label: '管理项目设置', title: '管理项目设置', description: '允许修改项目设置', group: '项目管理' },

  { key: 'create_driver', label: '创建司机', title: '创建司机', description: '允许添加新司机', group: '司机管理' },
  { key: 'edit_driver', label: '编辑司机', title: '编辑司机', description: '允许编辑司机信息', group: '司机管理' },
  { key: 'delete_driver', label: '删除司机', title: '删除司机', description: '允许删除司机', group: '司机管理' },
  { key: 'view_driver', label: '查看司机', title: '查看司机', description: '允许查看司机详情', group: '司机管理' },

  { key: 'create_partner', label: '创建合作方', title: '创建合作方', description: '允许添加新合作方', group: '合作方管理' },
  { key: 'edit_partner', label: '编辑合作方', title: '编辑合作方', description: '允许编辑合作方信息', group: '合作方管理' },
  { key: 'delete_partner', label: '删除合作方', title: '删除合作方', description: '允许删除合作方', group: '合作方管理' },
  { key: 'view_partner', label: '查看合作方', title: '查看合作方', description: '允许查看合作方详情', group: '合作方管理' },

  { key: 'create_logistics', label: '创建运单', title: '创建运单', description: '允许创建新运单', group: '运单管理' },
  { key: 'edit_logistics', label: '编辑运单', title: '编辑运单', description: '允许编辑运单信息', group: '运单管理' },
  { key: 'delete_logistics', label: '删除运单', title: '删除运单', description: '允许删除运单', group: '运单管理' },
  { key: 'view_logistics', label: '查看运单', title: '查看运单', description: '允许查看运单详情', group: '运单管理' },
  { key: 'import_logistics', label: '导入运单', title: '导入运单', description: '允许批量导入运单', group: '运单管理' },
  { key: 'export_logistics', label: '导出运单', title: '导出运单', description: '允许导出运单数据', group: '运单管理' },
  { key: 'approve_logistics', label: '审批运单', title: '审批运单', description: '允许审批运单', group: '运单管理' },

  { key: 'view_finance_data', label: '查看财务数据', title: '查看财务数据', description: '允许查看财务相关数据', group: '财务管理' },
  { key: 'create_payment_request', label: '创建付款申请', title: '创建付款申请', description: '允许创建付款申请', group: '财务管理' },
  { key: 'approve_payment', label: '审批付款', title: '审批付款', description: '允许审批付款申请', group: '财务管理' },
  { key: 'view_payment_request', label: '查看付款申请', title: '查看付款申请', description: '允许查看付款申请', group: '财务管理' },
  { key: 'manage_invoice', label: '管理发票', title: '管理发票', description: '允许管理发票', group: '财务管理' },

  { key: 'manage_users', label: '管理用户', title: '管理用户', description: '允许管理系统用户', group: '用户管理' },
  { key: 'manage_permissions', label: '管理权限', title: '管理权限', description: '允许管理用户权限', group: '权限管理' },
  { key: 'view_audit_logs', label: '查看审计日志', title: '查看审计日志', description: '允许查看系统审计日志', group: '审计管理' },

  { key: 'create_contract', label: '创建合同', title: '创建合同', description: '允许创建新合同', group: '合同管理' },
  { key: 'edit_contract', label: '编辑合同', title: '编辑合同', description: '允许编辑合同信息', group: '合同管理' },
  { key: 'delete_contract', label: '删除合同', title: '删除合同', description: '允许删除合同', group: '合同管理' },
  { key: 'view_contract', label: '查看合同', title: '查看合同', description: '允许查看合同详情', group: '合同管理' },
  { key: 'approve_contract', label: '审批合同', title: '审批合同', description: '允许审批合同', group: '合同管理' }
];

// 按钮权限配置
export const BUTTON_PERMISSIONS: ButtonPermission[] = [
  // 项目管理按钮
  { key: 'btn_create_project', label: '新建项目按钮', title: '新建项目按钮', description: '创建项目的按钮', group: '项目管理' },
  { key: 'btn_edit_project', label: '编辑项目按钮', title: '编辑项目按钮', description: '编辑项目的按钮', group: '项目管理' },
  { key: 'btn_delete_project', label: '删除项目按钮', title: '删除项目按钮', description: '删除项目的按钮', group: '项目管理' },

  // 司机管理按钮
  { key: 'btn_create_driver', label: '新建司机按钮', title: '新建司机按钮', description: '创建司机的按钮', group: '司机管理' },
  { key: 'btn_edit_driver', label: '编辑司机按钮', title: '编辑司机按钮', description: '编辑司机的按钮', group: '司机管理' },
  { key: 'btn_delete_driver', label: '删除司机按钮', title: '删除司机按钮', description: '删除司机的按钮', group: '司机管理' },

  // 运单管理按钮
  { key: 'btn_create_logistics', label: '新建运单按钮', title: '新建运单按钮', description: '创建运单的按钮', group: '运单管理' },
  { key: 'btn_edit_logistics', label: '编辑运单按钮', title: '编辑运单按钮', description: '编辑运单的按钮', group: '运单管理' },
  { key: 'btn_delete_logistics', label: '删除运单按钮', title: '删除运单按钮', description: '删除运单的按钮', group: '运单管理' },
  { key: 'btn_import_logistics', label: '导入运单按钮', title: '导入运单按钮', description: '导入运单的按钮', group: '运单管理' },
  { key: 'btn_export_logistics', label: '导出运单按钮', title: '导出运单按钮', description: '导出运单的按钮', group: '运单管理' },

  // 财务管理按钮
  { key: 'btn_create_payment', label: '创建付款申请按钮', title: '创建付款申请按钮', description: '创建付款申请的按钮', group: '财务管理' },
  { key: 'btn_approve_payment', label: '审批付款按钮', title: '审批付款按钮', description: '审批付款的按钮', group: '财务管理' },
  { key: 'btn_export_finance', label: '导出财务数据按钮', title: '导出财务数据按钮', description: '导出财务数据的按钮', group: '财务管理' },

  // 系统管理按钮
  { key: 'btn_manage_users', label: '管理用户按钮', title: '管理用户按钮', description: '管理用户的按钮', group: '用户管理' },
  { key: 'btn_manage_permissions', label: '管理权限按钮', title: '管理权限按钮', description: '管理权限的按钮', group: '权限管理' }
];

// 角色默认权限配置
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, {
  menu: string[];
  function: string[];
  button: string[];
}> = {
  admin: {
    menu: MENU_PERMISSIONS.flatMap(m => m.children ? [m.key, ...m.children.map(c => c.key)] : [m.key]),
    function: FUNCTION_PERMISSIONS.map(f => f.key),
    button: BUTTON_PERMISSIONS.map(b => b.key)
  },
  finance: {
    menu: [
      'dashboard', 'dashboard.financial', 'dashboard.project',
      'business', 'business.entry', 'business.import',
      'finance', 'finance.reconciliation', 'finance.payment_request', 'finance.payment_list',
      'finance.invoice', 'finance.financial_overview', 'finance.transport_overview',
      'finance.projects_overview', 'finance.project_dashboard', 'finance.payment_approval'
    ],
    function: [
      'view_project', 'view_driver', 'view_partner', 'view_logistics',
      'view_finance_data', 'create_payment_request', 'approve_payment',
      'view_payment_request', 'manage_invoice'
    ],
    button: [
      'btn_create_payment', 'btn_approve_payment', 'btn_export_finance'
    ]
  },
  business: {
    menu: [
      'dashboard', 'dashboard.transport', 'dashboard.project',
      'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.partners', 'maintenance.locations',
      'business', 'business.entry', 'business.import', 'business.maintenance', 'business.scale'
    ],
    function: [
      'view_project', 'create_driver', 'edit_driver', 'view_driver',
      'view_partner', 'create_logistics', 'edit_logistics', 'view_logistics',
      'import_logistics', 'export_logistics'
    ],
    button: [
      'btn_create_driver', 'btn_edit_driver', 'btn_create_logistics',
      'btn_edit_logistics', 'btn_import_logistics', 'btn_export_logistics'
    ]
  },
  operator: {
    menu: [
      'dashboard', 'dashboard.transport',
      'business', 'business.entry', 'business.scale'
    ],
    function: [
      'view_project', 'view_driver', 'create_logistics', 'edit_logistics', 'view_logistics'
    ],
    button: [
      'btn_create_logistics', 'btn_edit_logistics'
    ]
  },
  partner: {
    menu: [
      'dashboard', 'dashboard.transport',
      'finance', 'finance.payment_list', 'finance.transport_overview'
    ],
    function: [
      'view_project', 'view_logistics', 'view_payment_request'
    ],
    button: []
  },
  viewer: {
    menu: [
      'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project'
    ],
    function: [
      'view_project', 'view_driver', 'view_partner', 'view_logistics'
    ],
    button: []
  }
};

// 权限分组
export const PERMISSION_GROUPS = {
  MENU: '菜单权限',
  FUNCTION: '功能权限',
  BUTTON: '按钮权限',
  PROJECT: '项目权限'
} as const;

// 权限检查函数
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  return userPermissions.includes(requiredPermission) || userPermissions.includes('*');
};

// 角色权限检查
export const hasRolePermission = (userRole: UserRole, requiredPermission: string): boolean => {
  if (userRole === 'admin') return true;
  
  const rolePermissions = ROLE_DEFAULT_PERMISSIONS[userRole];
  return [
    ...rolePermissions.menu,
    ...rolePermissions.function,
    ...rolePermissions.button
  ].includes(requiredPermission);
};

// 获取用户可访问的菜单
export const getUserAccessibleMenus = (userRole: UserRole, customPermissions: string[] = []): MenuPermission[] => {
  const rolePermissions = ROLE_DEFAULT_PERMISSIONS[userRole];
  const allPermissions = [...rolePermissions.menu, ...customPermissions];
  
  return MENU_PERMISSIONS.filter(menu => {
    if (allPermissions.includes(menu.key)) {
      // 过滤子菜单
      if (menu.children) {
        menu.children = menu.children.filter(child => allPermissions.includes(child.key));
      }
      return true;
    }
    return false;
  });
};

// 项目权限检查
export const hasProjectPermission = (
  userRole: UserRole, 
  projectId: string, 
  requiredPermission: string,
  projectPermissions: ProjectPermission[] = []
): boolean => {
  if (userRole === 'admin') return true;
  
  // 检查项目特定权限
  const projectPerm = projectPermissions.find(p => 
    p.projectId === projectId && p.key === requiredPermission
  );
  
  return !!projectPerm;
};