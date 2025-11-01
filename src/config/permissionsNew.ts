// 新权限系统配置
// 文件: src/config/permissionsNew.ts

import { UserRole } from '@/types/permission';

// 权限项接口
export interface PermissionItemNew {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  scope?: string;
  requiredRoles?: UserRole[];
}

// 权限组接口
export interface PermissionGroupNew {
  key: string;
  label: string;
  children: PermissionItemNew[];
  icon?: string;
  requiredRoles?: UserRole[];
}

// 角色定义
export const ROLES_NEW: Record<UserRole, { label: string; color: string; description: string }> = {
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

// 导出 ROLES 别名以保持向后兼容
export const ROLES = ROLES_NEW;

// 菜单权限配置
export const MENU_PERMISSIONS_NEW: PermissionGroupNew[] = [
  {
    key: 'dashboard',
    label: '数据看板',
    icon: 'BarChart3',
    children: [
      { key: 'dashboard.transport', label: '运输看板', icon: 'Truck' },
      { key: 'dashboard.financial', label: '财务看板', icon: 'DollarSign' },
      { key: 'dashboard.project', label: '项目看板', icon: 'PieChart' },
      { key: 'dashboard.shipper', label: '货主看板', icon: 'TreePine' }
    ]
  },
  {
    key: 'contracts',
    label: '合同管理',
    icon: 'FileText',
    children: [
      { key: 'contracts.list', label: '合同列表', icon: 'FileText' }
    ]
  },
  {
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
    key: 'audit',
    label: '审核管理',
    icon: 'CheckCircle',
    children: [
      { key: 'audit.invoice', label: '开票审核', icon: 'FileText' },
      { key: 'audit.payment', label: '付款审核', icon: 'DollarSign' }
    ]
  },
  {
    key: 'settings',
    label: '设置',
    icon: 'Settings',
    requiredRoles: ['admin'],
    children: [
      { key: 'settings.users', label: '用户管理', icon: 'UserCog' },
      { key: 'settings.permissions', label: '权限配置', icon: 'Shield' },
      { key: 'settings.contract_permissions', label: '合同权限', icon: 'FileText' },
      { key: 'settings.role_templates', label: '角色模板', icon: 'Settings' },
      { key: 'settings.integrated', label: '集成权限管理', icon: 'Shield' },
      { key: 'settings.audit_logs', label: '操作日志', icon: 'History' }
    ]
  }
];

// 功能权限配置
export const FUNCTION_PERMISSIONS_NEW: PermissionGroupNew[] = [
  {
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
    key: 'contract_management',
    label: '合同管理',
    children: [
      { key: 'contract.view', label: '查看合同', description: '可以查看合同列表和基本信息' }
    ]
  }
];

// 项目权限配置
export const PROJECT_PERMISSIONS_NEW: PermissionGroupNew[] = [
  {
    key: 'project_access',
    label: '项目访问',
    children: [
      { key: 'project.view_all', label: '查看所有项目', description: '可以查看系统中的所有项目' },
      { key: 'project.view_assigned', label: '查看分配项目', description: '只能查看分配给自己的项目' },
      { key: 'project.create', label: '创建项目', description: '可以创建新项目' },
      { key: 'project.edit', label: '编辑项目', description: '可以修改项目信息' },
      { key: 'project.delete', label: '删除项目', description: '可以删除项目' }
    ]
  }
];

// 数据权限配置
export const DATA_PERMISSIONS_NEW: PermissionGroupNew[] = [
  {
    key: 'data_access',
    label: '数据访问',
    children: [
      { key: 'data.view_all', label: '查看所有数据', description: '可以查看系统中的所有数据' },
      { key: 'data.view_own', label: '查看自己的数据', description: '只能查看自己创建的数据' },
      { key: 'data.view_project', label: '查看项目数据', description: '可以查看项目相关的数据' },
      { key: 'data.export_all', label: '导出所有数据', description: '可以导出系统中的所有数据' },
      { key: 'data.export_own', label: '导出自己的数据', description: '只能导出自己创建的数据' }
    ]
  }
];

// 权限检查函数
export function hasPermission(userRole: UserRole, permission: string, permissions: PermissionGroupNew[]): boolean {
  for (const group of permissions) {
    for (const item of group.children) {
      if (item.key === permission) {
        if (!item.requiredRoles || item.requiredRoles.length === 0) {
          return true;
        }
        return item.requiredRoles.includes(userRole);
      }
    }
  }
  return false;
}

// 获取用户可访问的权限
export function getUserPermissions(userRole: UserRole, permissions: PermissionGroupNew[]): string[] {
  const userPermissions: string[] = [];
  
  for (const group of permissions) {
    if (!group.requiredRoles || group.requiredRoles.includes(userRole)) {
      for (const item of group.children) {
        if (!item.requiredRoles || item.requiredRoles.includes(userRole)) {
          userPermissions.push(item.key);
        }
      }
    }
  }
  
  return userPermissions;
}
