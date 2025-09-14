// 共享类型定义
export type UserRole = "admin" | "finance" | "business" | "partner" | "operator" | "viewer";

export interface UserWithPermissions {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  phone?: string;
  permissions?: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
}

export interface UserPermissions {
  menu: string[];
  function: string[];
  project: string[];
  data: string[];
}

export interface UserPermission {
  id: string;
  user_id: string;
  permissions: string[];
  role: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionTemplate {
  id: string;
  role: string;
  name: string;
  description: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleTemplate {
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}

export type PermissionType = 'menu' | 'function' | 'project' | 'data';

export interface ContractPermission {
  id: string;
  contract_id: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete' | 'manage' | 'sensitive' | 'approve' | 'archive' | 'audit';
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  description?: string;
  // 关联信息
  contract_number?: string;
  counterparty_company?: string;
  our_company?: string;
  category?: '行政合同' | '内部合同' | '业务合同';
  user_name?: string;
  role_name?: string;
  department_name?: string;
  granter_name?: string;
}

export interface ContractOwnerPermission {
  id: string;
  contract_id: string;
  owner_id: string;
  permissions: string[];
  granted_at: string;
  is_active: boolean;
  contract_number?: string;
  category?: string;
  counterparty_company?: string;
  owner_name?: string;
  owner_email?: string;
}

export interface CategoryPermissionTemplate {
  id: string;
  category: '行政合同' | '内部合同' | '业务合同';
  template_name: string;
  description?: string;
  default_permissions: string[];
  role_permissions: Record<string, string[]>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 新增：合同权限实时订阅相关类型
export interface ContractPermissionChange {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  contract_id?: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type?: string;
  timestamp: string;
}

export interface ContractPermissionSyncStatus {
  table_name: string;
  last_sync: string;
  sync_count: number;
  minutes_since_sync: number;
}

export interface ContractPermissionStats {
  total_permissions: number;
  active_permissions: number;
  expired_permissions: number;
  user_permissions: number;
  role_permissions: number;
  department_permissions: number;
  owner_permissions: number;
  by_permission_type: Record<string, number>;
  by_category: Record<string, number>;
}

// 新增：合同权限查询参数
export interface ContractPermissionQuery {
  contract_id?: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type?: string;
  is_active?: boolean;
  expires_at?: string;
}

// 新增：合同权限创建参数
export interface CreateContractPermissionParams {
  contract_id: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type: ContractPermission['permission_type'];
  expires_at?: string;
  description?: string;
}

// 新增：合同权限更新参数
export interface UpdateContractPermissionParams {
  permission_id: string;
  permission_type?: ContractPermission['permission_type'];
  expires_at?: string;
  description?: string;
  is_active?: boolean;
}