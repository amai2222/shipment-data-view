// 权限管理状态管理 Hook

import { useState, useEffect, useCallback } from 'react';
import { PermissionService } from '@/services/PermissionService';
import { 
  User, 
  Project, 
  RoleTemplate, 
  UserPermission, 
  PermissionState, 
  AppRole 
} from '@/types/permission';

export function usePermissionManager() {
  const [state, setState] = useState<PermissionState>({
    users: [],
    projects: [],
    roleTemplates: {} as Record<AppRole, RoleTemplate>,
    userPermissions: [],
    loading: false,
    error: null
  });

  // 加载所有数据
  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [users, projects, roleTemplates, userPermissions] = await Promise.all([
        PermissionService.getUsers(),
        PermissionService.getProjects(),
        PermissionService.getRoleTemplates(),
        PermissionService.getUserPermissions()
      ]);

      setState(prev => ({
        ...prev,
        users,
        projects,
        roleTemplates,
        userPermissions,
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

  // 保存角色模板
  const saveRoleTemplate = useCallback(async (template: Partial<RoleTemplate>) => {
    const result = await PermissionService.saveRoleTemplate(template);
    if (result.success) {
      await loadData(); // 重新加载数据
    }
    return result;
  }, [loadData]);

  // 保存用户权限
  const saveUserPermission = useCallback(async (permission: Partial<UserPermission>) => {
    const result = await PermissionService.saveUserPermission(permission);
    if (result.success) {
      await loadData(); // 重新加载数据
    }
    return result;
  }, [loadData]);

  // 删除用户权限
  const deleteUserPermission = useCallback(async (userId: string, projectId?: string) => {
    const result = await PermissionService.deleteUserPermission(userId, projectId);
    if (result.success) {
      await loadData(); // 重新加载数据
    }
    return result;
  }, [loadData]);

  // 批量更新用户角色
  const batchUpdateUserRoles = useCallback(async (userIds: string[], role: AppRole) => {
    const result = await PermissionService.batchUpdateUserRoles(userIds, role);
    if (result.success) {
      await loadData(); // 重新加载数据
    }
    return result;
  }, [loadData]);

  // 批量更新用户状态
  const batchUpdateUserStatus = useCallback(async (userIds: string[], isActive: boolean) => {
    const result = await PermissionService.batchUpdateUserStatus(userIds, isActive);
    if (result.success) {
      await loadData(); // 重新加载数据
    }
    return result;
  }, [loadData]);

  // 获取用户的有效权限（合并角色模板和用户特定权限）
  const getUserEffectivePermissions = useCallback((userId: string, projectId?: string) => {
    const user = state.users.find(u => u.id === userId);
    if (!user) return null;

    const userPermission = state.userPermissions.find(p => 
      p.user_id === userId && 
      (projectId ? p.project_id === projectId : !p.project_id)
    );

    const roleTemplate = state.roleTemplates[user.role];
    if (!roleTemplate) return null;

    // 如果用户有特定权限且不继承角色权限，使用用户特定权限
    if (userPermission && !userPermission.inherit_role) {
      return {
        menu_permissions: userPermission.menu_permissions,
        function_permissions: userPermission.function_permissions,
        project_permissions: userPermission.project_permissions,
        data_permissions: userPermission.data_permissions
      };
    }

    // 否则使用角色模板权限
    return {
      menu_permissions: roleTemplate.menu_permissions,
      function_permissions: roleTemplate.function_permissions,
      project_permissions: roleTemplate.project_permissions,
      data_permissions: roleTemplate.data_permissions
    };
  }, [state.users, state.userPermissions, state.roleTemplates]);

  // 初始化加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    loadData,
    saveRoleTemplate,
    saveUserPermission,
    deleteUserPermission,
    batchUpdateUserRoles,
    batchUpdateUserStatus,
    getUserEffectivePermissions
  };
}
