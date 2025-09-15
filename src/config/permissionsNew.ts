// 权限系统配置 - 新版本

import { PermissionGroup, AppRole, RoleDefinition } from '@/types/permission';

// 角色定义
export const ROLES: Record<AppRole, RoleDefinition> = {
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
export const MENU_PERMISSIONS: PermissionGroup[] = [
  {
    key: 'dashboard',
    label: '数据看板',
    children: [
      { key: 'dashboard.transport', label: '运输看板' },
      { key: 'dashboard.financial', label: '财务看板' },
      { key: 'dashboard.project', label: '项目看板' },
      { key: 'dashboard.quantity', label: '数量概览' }
    ]
  },
  {
    key: 'maintenance',
    label: '信息维护',
    children: [
      { key: 'maintenance.projects', label: '项目管理' },
      { key: 'maintenance.drivers', label: '司机管理' },
      { key: 'maintenance.locations', label: '地点管理' },
      { key: 'maintenance.partners', label: '合作方管理' }
    ]
  },
  {
    key: 'business',
    label: '业务管理',
    children: [
      { key: 'business.entry', label: '运单管理' },
      { key: 'business.scale', label: '磅单管理' },
      { key: 'business.payment_request', label: '付款申请' },
      { key: 'business.payment_requests', label: '申请单管理' }
    ]
  },
  {
    key: 'contracts',
    label: '合同管理',
    children: [
      { key: 'contracts.list', label: '合同列表' },
      { key: 'contracts.create', label: '新增合同' },
      { key: 'contracts.edit', label: '编辑合同' },
      { key: 'contracts.delete', label: '删除合同' },
      { key: 'contracts.files', label: '文件管理' },
      { key: 'contracts.permissions', label: '权限管理' },
      { key: 'contracts.audit', label: '审计日志' },
      { key: 'contracts.reminders', label: '提醒管理' },
      { key: 'contracts.tags', label: '标签管理' },
      { key: 'contracts.numbering', label: '编号管理' }
    ]
  },
  {
    key: 'finance',
    label: '财务对账',
    children: [
      { key: 'finance.reconciliation', label: '运费对账' },
      { key: 'finance.payment_invoice', label: '付款与开票' }
    ]
  },
  {
    key: 'data_maintenance',
    label: '数据维护',
    children: [
      { key: 'data_maintenance.waybill', label: '运单维护' }
    ]
  },
  {
    key: 'settings',
    label: '设置',
    children: [
      { key: 'settings.integrated', label: '集成权限管理' },
      { key: 'settings.audit_logs', label: '操作日志' }
    ]
  }
];

// 功能权限配置
export const FUNCTION_PERMISSIONS: PermissionGroup[] = [
  {
    key: 'data',
    label: '数据操作',
    children: [
      { key: 'data.create', label: '新增数据', description: '可以创建新的业务数据' },
      { key: 'data.edit', label: '编辑数据', description: '可以修改现有数据' },
      { key: 'data.delete', label: '删除数据', description: '可以删除数据' },
      { key: 'data.export', label: '导出数据', description: '可以导出数据到Excel' },
      { key: 'data.import', label: '导入数据', description: '可以从Excel导入数据' },
      { key: 'data.view', label: '查看数据', description: '可以查看数据' }
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
    label: '财务管理',
    children: [
      { key: 'finance.view_cost', label: '查看成本', description: '可以查看成本信息' },
      { key: 'finance.approve_payment', label: '审批付款', description: '可以审批付款申请' },
      { key: 'finance.generate_invoice', label: '生成发票', description: '可以生成发票' },
      { key: 'finance.reconcile', label: '财务对账', description: '可以进行财务对账' }
    ]
  },
  {
    key: 'contract_management',
    label: '合同管理',
    children: [
      { key: 'contract.view', label: '查看合同', description: '可以查看合同信息' },
      { key: 'contract.create', label: '创建合同', description: '可以创建新合同' },
      { key: 'contract.edit', label: '编辑合同', description: '可以修改合同' },
      { key: 'contract.delete', label: '删除合同', description: '可以删除合同' },
      { key: 'contract.archive', label: '归档合同', description: '可以归档合同' },
      { key: 'contract.files_upload', label: '上传文件', description: '可以上传合同文件' },
      { key: 'contract.files_download', label: '下载文件', description: '可以下载合同文件' },
      { key: 'contract.files_delete', label: '删除文件', description: '可以删除合同文件' },
      { key: 'contract.permissions_manage', label: '权限管理', description: '可以管理合同权限' },
      { key: 'contract.audit_logs', label: '审计日志', description: '可以查看审计日志' },
      { key: 'contract.reminders', label: '提醒管理', description: '可以管理合同提醒' },
      { key: 'contract.tags', label: '标签管理', description: '可以管理合同标签' },
      { key: 'contract.numbering', label: '编号管理', description: '可以管理合同编号' },
      { key: 'contract.sensitive_fields', label: '敏感字段', description: '可以查看敏感字段' },
      { key: 'contract.approve', label: '审批合同', description: '可以审批合同' },
      { key: 'contract.export', label: '导出合同', description: '可以导出合同数据' }
    ]
  },
  {
    key: 'system',
    label: '系统管理',
    children: [
      { key: 'system.manage_users', label: '用户管理', description: '可以管理系统用户' },
      { key: 'system.manage_roles', label: '角色管理', description: '可以管理系统角色' },
      { key: 'system.view_logs', label: '查看日志', description: '可以查看系统日志' },
      { key: 'system.backup', label: '数据备份', description: '可以进行数据备份' }
    ]
  }
];

// 项目权限配置
export const PROJECT_PERMISSIONS: PermissionGroup[] = [
  {
    key: 'project_access',
    label: '项目访问',
    children: [
      { key: 'project.view_all', label: '查看所有项目', description: '可以查看所有项目' },
      { key: 'project.view_assigned', label: '查看分配项目', description: '只能查看分配的项目' },
      { key: 'project.manage', label: '项目管理', description: '可以管理项目' },
      { key: 'project.admin', label: '项目管理员', description: '拥有项目所有权限' }
    ]
  },
  {
    key: 'project_data',
    label: '项目数据',
    children: [
      { key: 'project_data.view_financial', label: '查看财务数据', description: '可以查看项目财务数据' },
      { key: 'project_data.edit_financial', label: '编辑财务数据', description: '可以编辑项目财务数据' },
      { key: 'project_data.view_operational', label: '查看运营数据', description: '可以查看项目运营数据' },
      { key: 'project_data.edit_operational', label: '编辑运营数据', description: '可以编辑项目运营数据' }
    ]
  }
];

// 数据权限配置
export const DATA_PERMISSIONS: PermissionGroup[] = [
  {
    key: 'data_scope',
    label: '数据范围',
    children: [
      { key: 'data.all', label: '所有数据', description: '可以访问所有数据' },
      { key: 'data.own', label: '自己的数据', description: '只能访问自己的数据' },
      { key: 'data.team', label: '团队数据', description: '可以访问团队数据' },
      { key: 'data.project', label: '项目数据', description: '可以访问项目数据' }
    ]
  },
  {
    key: 'data_operations',
    label: '数据操作',
    children: [
      { key: 'data.create', label: '创建数据', description: '可以创建数据' },
      { key: 'data.edit', label: '编辑数据', description: '可以编辑数据' },
      { key: 'data.delete', label: '删除数据', description: '可以删除数据' },
      { key: 'data.export', label: '导出数据', description: '可以导出数据' }
    ]
  }
];
