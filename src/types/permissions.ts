// 共享类型定义
export type UserRole = "admin" | "finance" | "business" | "partner" | "operator" | "viewer";

export interface UserWithPermissions {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
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

export interface RoleTemplate {
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}

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
  role: string;
  permissions: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}