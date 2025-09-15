// 权限管理系统类型定义

import { UserRole } from './permissions';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RoleTemplate {
  id: string;
  role: UserRole;
  name: string;
  description: string;
  color: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  project_id?: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  inherit_role: boolean;
  custom_settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  children: PermissionItem[];
}

export interface PermissionItem {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionConfig {
  menu_permissions: PermissionGroup[];
  function_permissions: PermissionGroup[];
  project_permissions: PermissionGroup[];
  data_permissions: PermissionGroup[];
}

export type AppRole = UserRole;

export interface RoleDefinition {
  label: string;
  description: string;
  color: string;
}

export interface PermissionState {
  users: User[];
  projects: Project[];
  roleTemplates: Record<UserRole, RoleTemplate>;
  userPermissions: UserPermission[];
  loading: boolean;
  error: string | null;
}

export interface PermissionAction {
  type: 'SET_LOADING' | 'SET_ERROR' | 'SET_USERS' | 'SET_PROJECTS' | 'SET_ROLE_TEMPLATES' | 'SET_USER_PERMISSIONS' | 'UPDATE_ROLE_TEMPLATE' | 'UPDATE_USER_PERMISSION';
  payload: any;
}

export interface SaveResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}
