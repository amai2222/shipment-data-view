// 权限系统类型定义

// 用户角色枚举
export type UserRole = 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer';

// 权限类型
export type PermissionType = 'menu' | 'function' | 'project' | 'data';

// 菜单权限定义
export interface MenuPermission {
  key: string;
  label: string;
  group: string;
  icon?: string;
  url?: string;
  children?: MenuPermission[];
  requiredRoles?: UserRole[];
}

// 功能权限定义
export interface FunctionPermission {
  key: string;
  label: string;
  group: string;
  description?: string;
  requiredRoles?: UserRole[];
}

// 项目权限定义
export interface ProjectPermission {
  key: string;
  label: string;
  group: string;
  description?: string;
  scope: 'read' | 'write' | 'admin';
}

// 数据权限定义
export interface DataPermission {
  key: string;
  label: string;
  group: string;
  scope: 'view' | 'create' | 'edit' | 'delete' | 'export';
  conditions?: string[]; // 数据过滤条件
}

// 角色权限模板
export interface RolePermissionTemplate {
  id: string;
  role: UserRole;
  name: string;
  description: string;
  color: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  is_system: boolean; // 是否为系统预设角色
  created_at: string;
  updated_at: string;
}

// 用户权限配置
export interface UserPermission {
  id: string;
  user_id: string;
  project_id?: string; // null表示全局权限
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  inherit_role: boolean; // 是否继承角色权限
  custom_settings: Record<string, any>; // 个性化设置
  created_at: string;
  updated_at: string;
  created_by: string;
}

// 权限检查结果
export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
  inheritedFrom?: 'role' | 'user' | 'project';
}

// 权限上下文
export interface PermissionContext {
  userId: string;
  userRole: UserRole;
  currentProject?: string;
  permissions: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
}

// 权限配置表单数据
export interface PermissionFormData {
  role: UserRole;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}

// 用户权限表单数据
export interface UserPermissionFormData {
  user_id: string;
  project_id?: string;
  inherit_role: boolean;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  custom_settings: Record<string, any>;
}

// 权限审计日志
export interface PermissionAuditLog {
  id: string;
  user_id: string;
  action: 'grant' | 'revoke' | 'modify' | 'inherit';
  permission_type: PermissionType;
  permission_key: string;
  target_user_id?: string;
  target_project_id?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  created_at: string;
  created_by: string;
}
