// 用户管理状态管理 Hook

import { useState, useEffect, useCallback } from 'react';
import { UserManagementService } from '@/services/UserManagementService';
import { 
  User, 
  UserCreateData, 
  UserUpdateData, 
  UserBatchUpdateData, 
  UserManagementState,
  AppRole 
} from '@/types/userManagement';

export function useUserManagement() {
  const [state, setState] = useState<UserManagementState>({
    users: [],
    loading: false,
    error: null,
    selectedUsers: []
  });

  // 加载用户数据
  const loadUsers = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const users = await UserManagementService.getUsers();
      setState(prev => ({
        ...prev,
        users,
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, []);

  // 创建用户
  const createUser = useCallback(async (userData: UserCreateData) => {
    const result = await UserManagementService.createUser(userData);
    if (result.success) {
      await loadUsers(); // 重新加载数据
    }
    return result;
  }, [loadUsers]);

  // 更新用户
  const updateUser = useCallback(async (userData: UserUpdateData) => {
    const result = await UserManagementService.updateUser(userData);
    if (result.success) {
      await loadUsers(); // 重新加载数据
    }
    return result;
  }, [loadUsers]);

  // 删除用户
  const deleteUser = useCallback(async (userId: string) => {
    const result = await UserManagementService.deleteUser(userId);
    if (result.success) {
      await loadUsers(); // 重新加载数据
    }
    return result;
  }, [loadUsers]);

  // 批量更新用户角色
  const batchUpdateUserRoles = useCallback(async (userIds: string[], role: AppRole) => {
    const result = await UserManagementService.batchUpdateUserRoles(userIds, role);
    if (result.success) {
      await loadUsers(); // 重新加载数据
    }
    return result;
  }, [loadUsers]);

  // 批量更新用户状态
  const batchUpdateUserStatus = useCallback(async (userIds: string[], isActive: boolean) => {
    const result = await UserManagementService.batchUpdateUserStatus(userIds, isActive);
    if (result.success) {
      await loadUsers(); // 重新加载数据
    }
    return result;
  }, [loadUsers]);

  // 批量删除用户
  const batchDeleteUsers = useCallback(async (userIds: string[]) => {
    const result = await UserManagementService.batchDeleteUsers(userIds);
    if (result.success) {
      await loadUsers(); // 重新加载数据
    }
    return result;
  }, [loadUsers]);

  // 选择用户
  const selectUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      selectedUsers: [...prev.selectedUsers, userId]
    }));
  }, []);

  // 取消选择用户
  const unselectUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.filter(id => id !== userId)
    }));
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.length === prev.users.length ? [] : prev.users.map(u => u.id)
    }));
  }, []);

  // 清空选择
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedUsers: []
    }));
  }, []);

  // 初始化加载数据
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    ...state,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    batchUpdateUserRoles,
    batchUpdateUserStatus,
    batchDeleteUsers,
    selectUser,
    unselectUser,
    toggleSelectAll,
    clearSelection
  };
}
