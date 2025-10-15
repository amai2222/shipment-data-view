// 权限系统配置

import { PermissionGroup, UserRole, RoleDefinition } from '@/types/permission';

// 权限项接口
export interface PermissionItem {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  scope?: string;
  requiredRoles?: string[];
}

// 菜单权限接口
export interface MenuPermission extends PermissionGroup {
  icon?: string;
  url?: string;
  requiredRoles?: string[];
}

// 功能权限接口
export interface FunctionPermission extends PermissionGroup {
  requiredRoles?: string[];
}

// 项目权限接口
export interface ProjectPermission extends PermissionGroup {
  scope?: string;
  requiredRoles?: string[];
}

// 数据权限接口
export interface DataPermission extends PermissionGroup {
  scope?: string;
  requiredRoles?: string[];
}

// 角色定义
export const ROLES: Record<UserRole, RoleDefinition> = {
  admin: {
    label: '系统管理员',
    color: 'bg-red-500',
    description: '拥有系统所有权限，可以管理用户和权限'
  },
  finance: {
    label: '财务人员',
    color: 'bg-blue-500',
    description: '负责财务相关操作，包括付款审批、发票管理等'
  },
  business: {
    label: '业务人员',
    color: 'bg-green-500',
    description: '负责业务管理，包括项目管理、合同管理等'
  },
  operator: {
    label: '操作员',
    color: 'bg-yellow-500',
    description: '负责日常操作，包括数据录入、磅单管理等'
  },
  partner: {
    label: '合作方',
    color: 'bg-purple-500',
    description: '外部合作伙伴，只能查看相关数据'
  },
  viewer: {
    label: '查看者',
    color: 'bg-gray-500',
    description: '只能查看数据，不能进行任何修改操作'
  }
};

// 菜单权限配置
export const MENU_PERMISSIONS: MenuPermission[] = [
  {
    group: '数据看板',
    key: 'dashboard',
    label: '数据看板',
    icon: 'BarChart3',
    children: [
      { key: 'dashboard.transport', label: '运输看板', icon: 'Truck' },
      { key: 'dashboard.financial', label: '财务看板', icon: 'DollarSign' },
      { key: 'dashboard.project', label: '项目看板', icon: 'PieChart' }
    ]
  },
  {
    group: '合同管理',
    key: 'contracts',
    label: '合同管理',
    icon: 'FileText',
    children: [
      { key: 'contracts.list', label: '合同列表', icon: 'FileText' }
    ]
  },
  {
    group: '信息维护',
    key: 'maintenance',
    label: '信息维护',
    icon: 'Database',
    children: [
      { key: 'maintenance.projects', label: '项目管理', icon: 'Package' },
      { key: 'maintenance.drivers', label: '司机管理', icon: 'Truck' },
      { key: 'maintenance.locations', label: '地点管理', icon: 'MapPin' },
      { key: 'maintenance.locations_enhanced', label: '地点管理（增强版）', icon: 'MapPin' },
      { key: 'maintenance.partners', label: '合作方管理', icon: 'Users' }
    ]
  },
  {
    group: '业务管理',
    key: 'business',
    label: '业务管理',
    icon: 'FileText',
    children: [
      { key: 'business.entry', label: '运单管理', icon: 'Plus' },
      { key: 'business.scale', label: '磅单管理', icon: 'Weight' },
      { key: 'business.invoice_request', label: '开票申请', icon: 'FileText' },
      { key: 'business.payment_request', label: '付款申请', icon: 'DollarSign' }
    ]
  },
  {
    group: '财务管理',
    key: 'finance',
    label: '财务管理',
    icon: 'Calculator',
    children: [
      { key: 'finance.reconciliation', label: '运费对账', icon: 'Calculator' },
      { key: 'finance.payment_invoice', label: '付款与开票', icon: 'DollarSign' },
      { key: 'finance.invoice_request_management', label: '开票申请单管理', icon: 'FileText' },
      { key: 'finance.payment_requests', label: '付款申请单管理', icon: 'ClipboardList' }
    ]
  },
  {
    group: '数据维护',
    key: 'data_maintenance',
    label: '数据维护',
    icon: 'Database',
    children: [
      { key: 'data_maintenance.waybill', label: '运单维护', icon: 'Truck' },
      { key: 'data_maintenance.waybill_enhanced', label: '运单维护（增强版）', icon: 'Truck' }
    ],
    requiredRoles: ['admin', 'operator']
  },
  {
    group: '设置',
    key: 'settings',
    label: '设置',
    icon: 'Settings',
    children: [
      { key: 'settings.users', label: '用户管理', icon: 'UserCog' },
      { key: 'settings.permissions', label: '权限配置', icon: 'Shield' },
      { key: 'settings.contract_permissions', label: '合同权限', icon: 'FileText' },
      { key: 'settings.role_templates', label: '角色模板', icon: 'Settings' },
      { key: 'settings.integrated', label: '集成权限管理', icon: 'Shield' },
      { key: 'settings.audit_logs', label: '操作日志', icon: 'History' }
    ],
    requiredRoles: ['admin']
  }
];

// 功能权限配置
export const FUNCTION_PERMISSIONS: FunctionPermission[] = [
  {
    group: '数据操作',
    key: 'data',
    label: '数据操作',
    children: [
      { key: 'data.create', label: '新增数据', description: '可以创建新的业务数据' },
      { key: 'data.edit', label: '编辑数据', description: '可以修改现有数据' },
      { key: 'data.delete', label: '删除数据', description: '可以删除数据' },
      { key: 'data.export', label: '导出数据', description: '可以导出数据到Excel' },
      { key: 'data.import', label: '导入数据', description: '可以从Excel导入数据' }
    ]
  },
  {
    group: '磅单管理',
    key: 'scale_records',
    label: '磅单管理',
    children: [
      { key: 'scale_records.create', label: '新增磅单', description: '可以创建新的磅单记录' },
      { key: 'scale_records.edit', label: '编辑磅单', description: '可以修改磅单记录' },
      { key: 'scale_records.view', label: '查看磅单', description: '可以查看磅单记录' },
      { key: 'scale_records.delete', label: '删除磅单', description: '可以删除磅单记录' }
    ]
  },
  {
    group: '财务操作',
    key: 'finance',
    label: '财务操作',
    children: [
      { key: 'finance.view_cost', label: '查看成本信息', description: '可以查看成本相关数据' },
      { key: 'finance.approve_payment', label: '审批付款', description: '可以审批付款申请' },
      { key: 'finance.generate_invoice', label: '生成发票', description: '可以生成发票' },
      { key: 'finance.reconcile', label: '财务对账', description: '可以进行财务对账' }
    ]
  },
  {
    group: '合同管理',
    key: 'contract_management',
    label: '合同管理',
    children: [
      { key: 'contract.view', label: '查看合同', description: '可以查看合同列表和基本信息' }
    ]
  },
  {
    group: '系统管理',
    key: 'system',
    label: '系统管理',
    children: [
      { key: 'system.manage_users', label: '管理用户', description: '可以管理用户账户', group: '系统管理' },
      { key: 'system.manage_roles', label: '管理角色', description: '可以管理角色权限', group: '系统管理' },
      { key: 'system.view_logs', label: '查看日志', description: '可以查看系统日志', group: '系统管理' },
      { key: 'system.backup', label: '系统备份', description: '可以进行系统备份', group: '系统管理' }
    ],
    requiredRoles: ['admin']
  }
];

// 项目权限配置
export const PROJECT_PERMISSIONS: ProjectPermission[] = [
  {
    group: '项目访问',
    key: 'project_access',
    label: '项目访问',
    children: [
      { key: 'project.view_all', label: '查看所有项目', scope: 'read', description: '可以查看所有项目数据', group: '项目访问' },
      { key: 'project.view_assigned', label: '查看分配项目', scope: 'read', description: '只能查看分配的项目', group: '项目访问' },
      { key: 'project.manage', label: '项目管理', scope: 'write', description: '可以管理项目信息', group: '项目访问' },
      { key: 'project.admin', label: '项目管理员', scope: 'admin', description: '拥有项目完全管理权限', group: '项目访问' }
    ]
  },
  {
    group: '项目数据',
    key: 'project_data',
    label: '项目数据',
    children: [
      { key: 'project_data.view_financial', label: '查看财务数据', scope: 'read', description: '可以查看项目财务信息', group: '项目数据' },
      { key: 'project_data.edit_financial', label: '编辑财务数据', scope: 'write', description: '可以修改项目财务信息', group: '项目数据' },
      { key: 'project_data.view_operational', label: '查看运营数据', scope: 'read', description: '可以查看项目运营数据', group: '项目数据' },
      { key: 'project_data.edit_operational', label: '编辑运营数据', scope: 'write', description: '可以修改项目运营数据', group: '项目数据' }
    ]
  }
];

// 数据权限配置
export const DATA_PERMISSIONS: DataPermission[] = [
  {
    group: '数据范围',
    key: 'data_scope',
    label: '数据范围',
    children: [
      { key: 'data.all', label: '所有数据', scope: 'view', description: '可以访问所有数据', group: '数据范围' },
      { key: 'data.own', label: '自己的数据', scope: 'view', description: '只能访问自己创建的数据', group: '数据范围' },
      { key: 'data.team', label: '团队数据', scope: 'view', description: '可以访问团队数据', group: '数据范围' },
      { key: 'data.project', label: '项目数据', scope: 'view', description: '可以访问指定项目数据', group: '数据范围' }
    ]
  },
  {
    group: '数据操作',
    key: 'data_operations',
    label: '数据操作',
    children: [
      { key: 'data.create', label: '创建数据', scope: 'create', description: '可以创建新数据', group: '数据操作' },
      { key: 'data.edit', label: '编辑数据', scope: 'edit', description: '可以修改数据', group: '数据操作' },
      { key: 'data.delete', label: '删除数据', scope: 'delete', description: '可以删除数据', group: '数据操作' },
      { key: 'data.export', label: '导出数据', scope: 'export', description: '可以导出数据', group: '数据操作' }
    ]
  }
];

// 默认角色权限模板
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, {
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}> = {
  admin: {
    menu_permissions: [
      // 数据看板
      'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project',
      // 信息维护
      'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.locations_enhanced', 'maintenance.partners',
      // 业务管理
      'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.invoice_request',
      // 合同管理
      'contracts', 'contracts.list',
      // 财务管理
      'finance', 'finance.reconciliation', 'finance.payment_invoice', 'finance.payment_requests', 'finance.invoice_request_management',
      // 数据维护
      'data_maintenance', 'data_maintenance.waybill', 'data_maintenance.waybill_enhanced',
      // 设置
      'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
    ],
    function_permissions: [
      'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
      'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
      'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
      'contract_management', 'contract.view',
      'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
    ],
    project_permissions: [
      'project_access', 'project.view_all', 'project.view_assigned', 'project.manage', 'project.admin',
      'project_data', 'project_data.view_financial', 'project_data.edit_financial', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    data_permissions: [
      'data_scope', 'data.all', 'data.own', 'data.team', 'data.project',
      'data_operations', 'data.create', 'data.edit', 'data.delete', 'data.export'
    ]
  },
  finance: {
    menu_permissions: [
      'dashboard', 'dashboard.financial', 'dashboard.project',
      'maintenance', 'maintenance.partners',
      'business', 'business.payment_request', 'business.invoice_request',
      'contracts', 'contracts.list',
      'finance', 'finance.reconciliation', 'finance.payment_invoice', 'finance.payment_requests', 'finance.invoice_request_management'
    ],
    function_permissions: [
      'data', 'data.view', 'data.export',
      'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
      'scale_records', 'scale_records.view',
      'contract_management', 'contract.view',
    ],
    project_permissions: [
      'project_access', 'project.view_all',
      'project_data', 'project_data.view_financial', 'project_data.edit_financial'
    ],
    data_permissions: [
      'data_scope', 'data.all',
      'data_operations', 'data.export'
    ]
  },
  business: {
    menu_permissions: [
      'dashboard', 'dashboard.transport', 'dashboard.project',
      'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.locations_enhanced', 'maintenance.partners',
      'business', 'business.entry', 'business.scale',
      'contracts', 'contracts.list',
      'finance', 'finance.reconciliation'
    ],
    function_permissions: [
      'data', 'data.create', 'data.edit', 'data.export',
      'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view',
      'finance', 'finance.view_cost',
      'contract_management', 'contract.view',
    ],
    project_permissions: [
      'project_access', 'project.view_assigned', 'project.manage',
      'project_data', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    data_permissions: [
      'data_scope', 'data.team',
      'data_operations', 'data.create', 'data.edit', 'data.export'
    ]
  },
  operator: {
    menu_permissions: [
      // 数据看板
      'dashboard', 'dashboard.transport', 'dashboard.financial',
      // 信息维护
      'maintenance', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
      // 业务管理
      'business', 'business.entry', 'business.scale', 'business.invoice_request', 'business.payment_request',
      // 财务管理
      'finance', 'finance.reconciliation', 'finance.payment_invoice', 'finance.payment_requests', 'finance.invoice_request_management',
      // 数据维护
      'data_maintenance', 'data_maintenance.waybill', 'data_maintenance.waybill_enhanced',
      // 合同管理
      'contracts', 'contracts.list'
    ],
    function_permissions: [
      // 数据操作
      'data', 'data.create', 'data.edit', 'data.view', 'data.export',
      // 磅单管理
      'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
      // 财务操作
      'finance', 'finance.view_cost', 'finance.generate_invoice', 'finance.reconcile',
      // 合同管理
      'contract_management', 'contract.view'
    ],
    project_permissions: [
      'project_access', 'project.view_assigned', 'project.view_all',
      'project_data', 'project_data.view_operational', 'project_data.view_financial'
    ],
    data_permissions: [
      'data_scope', 'data.own', 'data.team', 'data.all',
      'data_operations', 'data.create', 'data.edit', 'data.view', 'data.export'
    ]
  },
  partner: {
    menu_permissions: [
      'dashboard', 'dashboard.transport'
    ],
    function_permissions: [
      'data', 'data.view'
    ],
    project_permissions: [
      'project_access', 'project.view_assigned'
    ],
    data_permissions: [
      'data_scope', 'data.own'
    ]
  },
  viewer: {
    menu_permissions: [
      'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project',
      'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.locations_enhanced', 'maintenance.partners',
      'contracts', 'contracts.list',
      'finance', 'finance.reconciliation'
    ],
    function_permissions: [
      'data', 'data.view',
      'scale_records', 'scale_records.view',
      'finance', 'finance.view_cost',
      'contract_management', 'contract.view'
    ],
    project_permissions: [
      'project_access', 'project.view_all',
      'project_data', 'project_data.view_financial', 'project_data.view_operational'
    ],
    data_permissions: [
      'data_scope', 'data.all',
      'data_operations'
    ]
  }
};
