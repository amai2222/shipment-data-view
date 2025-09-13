// 权限配置文件
import { LucideIcon } from 'lucide-react';

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

export interface DataPermission {
  key: string;
  label: string;
  title: string;
  description: string;
  group: string;
  resource: string;
  action: string;
}

export interface ProjectPermission {
  key: string;
  label: string;
  title: string;
  description: string;
  group: string;
  action: string;
}

// 菜单权限定义
export const MENU_PERMISSIONS: MenuPermission[] = [
  {
    group: '数据看板',
    key: 'dashboard',
    label: '数据看板',
    title: '数据看板',
    icon: 'BarChart3',
    children: [
      { key: 'dashboard.transport', title: '运输看板', label: '运输看板', url: '/dashboard/transport', icon: 'Truck', group: '数据看板' },
      { key: 'dashboard.financial', title: '财务看板', label: '财务看板', url: '/dashboard/financial', icon: 'DollarSign', group: '数据看板' },
      { key: 'dashboard.project', title: '项目看板', label: '项目看板', url: '/dashboard/project', icon: 'PieChart', group: '数据看板' },
      { key: 'dashboard.quantity', title: '数量概览', label: '数量概览', url: '/quantity-overview', icon: 'Package', group: '数据看板' }
    ]
  },
  {
    group: '信息维护',
    key: 'maintenance',
    label: '信息维护',
    title: '信息维护',
    icon: 'Database',
    children: [
      { key: 'maintenance.projects', title: '项目管理', label: '项目管理', url: '/projects', icon: 'Package', group: '信息维护' },
      { key: 'maintenance.drivers', title: '司机管理', label: '司机管理', url: '/drivers', icon: 'Truck', group: '信息维护' },
      { key: 'maintenance.locations', title: '地点管理', label: '地点管理', url: '/locations', icon: 'MapPin', group: '信息维护' },
      { key: 'maintenance.partners', title: '合作方管理', label: '合作方管理', url: '/partners', icon: 'Users', group: '信息维护' }
    ]
  },
  {
    group: '业务管理',
    key: 'business',
    label: '业务管理',
    title: '业务管理',
    icon: 'FileText',
    children: [
      { key: 'business.entry', title: '运单管理', label: '运单管理', url: '/business-entry', icon: 'Plus', group: '业务管理' },
      { key: 'business.scale', title: '磅单管理', label: '磅单管理', url: '/scale-records', icon: 'Weight', group: '业务管理' },
      { key: 'business.payment_request', title: '付款申请', label: '付款申请', url: '/payment-request', icon: 'DollarSign', group: '业务管理' },
      { key: 'business.payment_requests', title: '申请单管理', label: '申请单管理', url: '/payment-requests-list', icon: 'ClipboardList', group: '业务管理' }
    ]
  },
  {
    group: '合同管理',
    key: 'contracts',
    label: '合同管理',
    title: '合同管理',
    icon: 'FileText',
    children: [
      { key: 'contracts.list', title: '合同列表', label: '合同列表', url: '/contracts', icon: 'FileText', group: '合同管理' },
      { key: 'contracts.create', title: '新增合同', label: '新增合同', url: '/contracts', icon: 'Plus', group: '合同管理' },
      { key: 'contracts.edit', title: '编辑合同', label: '编辑合同', url: '/contracts', icon: 'Edit', group: '合同管理' },
      { key: 'contracts.delete', title: '删除合同', label: '删除合同', url: '/contracts', icon: 'Trash2', group: '合同管理' },
      { key: 'contracts.files', title: '文件管理', label: '文件管理', url: '/contracts', icon: 'File', group: '合同管理' },
      { key: 'contracts.permissions', title: '权限管理', label: '权限管理', url: '/contracts', icon: 'Shield', group: '合同管理' },
      { key: 'contracts.audit', title: '审计日志', label: '审计日志', url: '/contracts', icon: 'History', group: '合同管理' },
      { key: 'contracts.reminders', title: '提醒管理', label: '提醒管理', url: '/contracts', icon: 'Bell', group: '合同管理' },
      { key: 'contracts.tags', title: '标签管理', label: '标签管理', url: '/contracts', icon: 'Tag', group: '合同管理' },
      { key: 'contracts.numbering', title: '编号管理', label: '编号管理', url: '/contracts', icon: 'Hash', group: '合同管理' }
    ]
  },
  {
    group: '财务管理',
    key: 'finance',
    label: '财务管理',
    title: '财务管理',
    icon: 'Calculator',
    children: [
      { key: 'finance.reconciliation', title: '财务对账', label: '财务对账', url: '/finance-reconciliation', icon: 'Calculator', group: '财务管理' },
      { key: 'finance.overview', title: '财务概览', label: '财务概览', url: '/financial-overview', icon: 'TrendingUp', group: '财务管理' }
    ]
  },
  {
    group: '数据维护',
    key: 'data_maintenance',
    label: '数据维护',
    title: '数据维护',
    icon: 'Database',
    children: [
      { key: 'data_maintenance.waybill', title: '运单维护', label: '运单维护', url: '/data-maintenance/waybill', icon: 'Truck', group: '数据维护' }
    ]
  },
  {
    group: '系统管理',
    key: 'system',
    label: '系统管理',
    title: '系统管理',
    icon: 'Settings',
    children: [
      { key: 'system.users', title: '用户管理', label: '用户管理', url: '/user-management', icon: 'Users', group: '系统管理' },
      { key: 'system.permissions', title: '权限管理', label: '权限管理', url: '/permission-management', icon: 'Shield', group: '系统管理' },
      { key: 'system.audit', title: '审计日志', label: '审计日志', url: '/audit-logs', icon: 'History', group: '系统管理' },
      { key: 'system.integrated_users', title: '综合用户管理', label: '综合用户管理', url: '/integrated-user-management', icon: 'UserCheck', group: '系统管理' }
    ]
  }
];

// 功能权限定义
export const FUNCTION_PERMISSIONS: FunctionPermission[] = [
  {
    group: '数据导入导出',
    key: 'import.excel',
    label: 'Excel导入',
    title: 'Excel导入',
    description: '允许导入Excel文件'
  },
  {
    group: '数据导入导出',
    key: 'export.excel',
    label: 'Excel导出',
    title: 'Excel导出',
    description: '允许导出Excel文件'
  },
  {
    group: '数据导入导出',
    key: 'import.update',
    label: '更新导入',
    title: '更新导入',
    description: '允许更新模式导入数据'
  },
  {
    group: '数据导入导出',
    key: 'export.payment',
    label: '付款导出',
    title: '付款导出',
    description: '允许导出付款申请'
  },
  {
    group: '数据导入导出',
    key: 'import.template',
    label: '模板导入',
    title: '模板导入',
    description: '允许使用导入模板'
  },
  {
    group: '数据操作',
    key: 'data.batch_delete',
    label: '批量删除',
    title: '批量删除',
    description: '允许批量删除数据'
  },
  {
    group: '数据操作',
    key: 'data.batch_edit',
    label: '批量编辑',
    title: '批量编辑',
    description: '允许批量编辑数据'
  },
  {
    group: '数据操作',
    key: 'data.bulk_calculate',
    label: '批量计算',
    title: '批量计算',
    description: '允许批量重新计算成本'
  },
  {
    group: '数据操作',
    key: 'data.advanced_search',
    label: '高级搜索',
    title: '高级搜索',
    description: '允许使用高级搜索功能'
  },
  {
    group: '系统管理',
    key: 'system.user_management',
    label: '用户管理',
    title: '用户管理',
    description: '允许管理系统用户'
  },
  {
    group: '系统管理',
    key: 'system.permission_management',
    label: '权限管理',
    title: '权限管理',
    description: '允许管理用户权限'
  },
  {
    group: '系统管理',
    key: 'system.audit_logs',
    label: '审计日志',
    title: '审计日志',
    description: '允许查看系统审计日志'
  },
  {
    group: '财务操作',
    key: 'finance.approve_payment',
    label: '付款审批',
    title: '付款审批',
    description: '允许审批付款申请'
  },
  {
    group: '财务操作',
    key: 'finance.reject_payment',
    label: '付款拒绝',
    title: '付款拒绝',
    description: '允许拒绝付款申请'
  },
  {
    group: '财务操作',
    key: 'finance.view_all_finance',
    label: '查看所有财务数据',
    title: '查看所有财务数据',
    description: '允许查看所有项目的财务数据'
  }
];

// 数据权限定义
export const DATA_PERMISSIONS: DataPermission[] = [
  {
    group: '项目数据',
    key: 'projects.all',
    label: '查看所有项目',
    title: '查看所有项目',
    description: '可以查看和操作所有项目的数据',
    resource: 'projects',
    action: 'read'
  },
  {
    group: '项目数据',
    key: 'projects.own',
    label: '仅查看自己的项目',
    title: '仅查看自己的项目',
    description: '只能查看和操作自己创建的项目',
    resource: 'projects',
    action: 'read_own'
  },
  {
    group: '财务数据',
    key: 'finance.all',
    label: '查看所有财务数据',
    title: '查看所有财务数据',
    description: '可以查看所有项目的财务数据',
    resource: 'finance',
    action: 'read'
  },
  {
    group: '财务数据',
    key: 'finance.own',
    label: '仅查看自己的财务数据',
    title: '仅查看自己的财务数据',
    description: '只能查看自己项目的财务数据',
    resource: 'finance',
    action: 'read_own'
  },
  {
    group: '运单数据',
    key: 'logistics.all',
    label: '查看所有运单',
    title: '查看所有运单',
    description: '可以查看和操作所有运单数据',
    resource: 'logistics',
    action: 'read'
  },
  {
    group: '运单数据',
    key: 'logistics.own',
    label: '仅查看自己的运单',
    title: '仅查看自己的运单',
    description: '只能查看和操作自己创建的运单',
    resource: 'logistics',
    action: 'read_own'
  }
];

// 项目权限定义
export const PROJECT_PERMISSIONS: ProjectPermission[] = [
  {
    group: '项目管理',
    key: 'project.create',
    label: '创建项目',
    title: '创建项目',
    description: '允许创建新项目',
    action: 'create'
  },
  {
    group: '项目管理',
    key: 'project.edit',
    label: '编辑项目',
    title: '编辑项目',
    description: '允许编辑项目信息',
    action: 'update'
  },
  {
    group: '项目管理',
    key: 'project.delete',
    label: '删除项目',
    title: '删除项目',
    description: '允许删除项目',
    action: 'delete'
  },
  {
    group: '项目管理',
    key: 'project.assign_users',
    label: '分配用户',
    title: '分配用户',
    description: '允许给项目分配用户',
    action: 'assign'
  }
];

// 角色定义
export const ROLES = {
  admin: {
    label: '超级管理员',
    description: '拥有系统所有权限',
    color: 'bg-red-500',
  },
  finance: {
    label: '财务管理员',
    description: '负责财务相关功能',
    color: 'bg-green-500',
  },
  business: {
    label: '业务管理员',
    description: '负责业务流程管理',
    color: 'bg-blue-500',
  },
  operator: {
    label: '操作员',
    description: '日常业务操作人员',
    color: 'bg-yellow-500',
  },
  partner: {
    label: '合作方用户',
    description: '外部合作方人员',
    color: 'bg-purple-500',
  },
  viewer: {
    label: '只读用户',
    description: '只能查看数据',
    color: 'bg-gray-500',
  }
};

// 默认权限配置
export const DEFAULT_PERMISSIONS = {
  admin: {
    menu_permissions: MENU_PERMISSIONS.flatMap(group => 
      group.children ? group.children.map(child => child.key) : [group.key]
    ),
    function_permissions: FUNCTION_PERMISSIONS.map(perm => perm.key),
    data_permissions: DATA_PERMISSIONS.map(perm => perm.key),
    project_permissions: PROJECT_PERMISSIONS.map(perm => perm.key)
  },
  finance: {
    menu_permissions: [
      'dashboard.financial',
      'finance.reconciliation',
      'finance.overview',
      'business.payment_requests'
    ],
    function_permissions: [
      'export.excel',
      'export.payment',
      'finance.approve_payment',
      'finance.reject_payment',
      'finance.view_all_finance'
    ],
    data_permissions: ['finance.all'],
    project_permissions: []
  },
  business: {
    menu_permissions: [
      'dashboard.transport',
      'dashboard.project',
      'business.entry',
      'business.scale',
      'business.payment_request',
      'maintenance.projects',
      'maintenance.drivers',
      'maintenance.locations',
      'data_maintenance.waybill'
    ],
    function_permissions: [
      'import.excel',
      'export.excel',
      'import.update',
      'data.batch_edit',
      'data.advanced_search'
    ],
    data_permissions: ['projects.all', 'logistics.all'],
    project_permissions: ['project.create', 'project.edit']
  },
  operator: {
    menu_permissions: [
      'business.entry',
      'business.scale',
      'dashboard.quantity',
      'data_maintenance.waybill'
    ],
    function_permissions: [
      'import.excel',
      'export.excel'
    ],
    data_permissions: ['projects.own', 'logistics.own'],
    project_permissions: []
  },
  partner: {
    menu_permissions: [
      'dashboard.quantity',
      'business.payment_requests'
    ],
    function_permissions: [],
    data_permissions: ['projects.own', 'logistics.own', 'finance.own'],
    project_permissions: []
  },
  viewer: {
    menu_permissions: [
      'dashboard.transport',
      'dashboard.financial',
      'dashboard.project',
      'dashboard.quantity'
    ],
    function_permissions: ['export.excel'],
    data_permissions: ['projects.own', 'logistics.own', 'finance.own'],
    project_permissions: []
  }
};