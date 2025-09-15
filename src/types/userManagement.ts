// 用户管理类型定义

import { UserRole } from './permissions';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone?: string;
  work_wechat_userid?: string;
  created_at: string;
  updated_at: string;
}

export interface UserCreateData {
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  work_wechat_userid?: string;
  password?: string;
}

export interface UserUpdateData {
  id: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  phone?: string;
  work_wechat_userid?: string;
  password?: string;
}

export interface UserBatchUpdateData {
  userIds: string[];
  role?: UserRole;
  is_active?: boolean;
}

export interface UserManagementState {
  users: User[];
  loading: boolean;
  error: string | null;
  selectedUsers: string[];
}

export interface UserManagementAction {
  type: 'SET_LOADING' | 'SET_ERROR' | 'SET_USERS' | 'SET_SELECTED_USERS' | 'ADD_SELECTED_USER' | 'REMOVE_SELECTED_USER' | 'CLEAR_SELECTED_USERS';
  payload: any;
}

export interface UserOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface RoleDefinition {
  label: string;
  description: string;
  color: string;
}
