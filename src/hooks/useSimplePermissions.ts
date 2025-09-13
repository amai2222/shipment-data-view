// 简化版权限管理Hook，避免循环依赖

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/permissions';
import { DEFAULT_ROLE_PERMISSIONS } from '@/config/permissions';

export function useSimplePermissions() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  // 获取用户角色
  const userRole = useMemo(() => {
    const role = profile?.role as UserRole || 'viewer';
    console.log(`当前用户角色: ${role}, 用户信息:`, profile);
    return role;
  }, [profile?.role]);

  // 获取角色默认权限
  const rolePermissions = useMemo(() => {
    try {
      const permissions = DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.viewer;
      console.log(`用户角色: ${userRole}, 权限配置:`, permissions);
      return permissions;
    } catch (error) {
      console.error('获取角色权限失败:', error);
      return DEFAULT_ROLE_PERMISSIONS.viewer;
    }
  }, [userRole]);

  // 检查菜单权限
  const hasMenuAccess = (menuKey: string): boolean => {
    try {
      if (!rolePermissions || !rolePermissions.menu_permissions) {
        console.log(`菜单权限检查失败 - 角色权限未加载: ${menuKey}`);
        return false;
      }
      const hasAccess = rolePermissions.menu_permissions.includes(menuKey);
      console.log(`菜单权限检查: ${menuKey} - 用户角色: ${userRole} - 有权限: ${hasAccess}`);
      return hasAccess;
    } catch (error) {
      console.error('菜单权限检查失败:', error);
      return false;
    }
  };

  // 检查功能权限
  const hasFunctionAccess = (functionKey: string): boolean => {
    try {
      if (!rolePermissions || !rolePermissions.function_permissions) {
        return false;
      }
      return rolePermissions.function_permissions.includes(functionKey);
    } catch (error) {
      console.error('功能权限检查失败:', error);
      return false;
    }
  };

  // 检查项目权限
  const hasProjectAccess = (projectKey: string): boolean => {
    try {
      if (!rolePermissions || !rolePermissions.project_permissions) {
        return false;
      }
      return rolePermissions.project_permissions.includes(projectKey);
    } catch (error) {
      console.error('项目权限检查失败:', error);
      return false;
    }
  };

  // 检查数据权限
  const hasDataAccess = (dataKey: string): boolean => {
    try {
      if (!rolePermissions || !rolePermissions.data_permissions) {
        return false;
      }
      return rolePermissions.data_permissions.includes(dataKey);
    } catch (error) {
      console.error('数据权限检查失败:', error);
      return false;
    }
  };

  // 检查是否为管理员
  const isAdmin = useMemo(() => {
    const admin = userRole === 'admin';
    console.log(`用户是否为管理员: ${admin}`);
    return admin;
  }, [userRole]);

  return {
    loading,
    userRole,
    isAdmin,
    rolePermissions,
    hasMenuAccess,
    hasFunctionAccess,
    hasProjectAccess,
    hasDataAccess
  };
}
