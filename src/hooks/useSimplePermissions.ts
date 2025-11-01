// 简化版权限管理Hook，从数据库加载权限

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/permission';
import { safeLogger } from '@/utils/safeLogger';

interface RolePermissions {
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}

export function useSimplePermissions() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dbPermissions, setDbPermissions] = useState<RolePermissions | null>(null);

  // 获取用户角色
  const userRole = useMemo(() => {
    const role = profile?.role as UserRole || 'viewer';
    // 使用安全的debug调用
    safeLogger.debug('当前用户角色:', role, '用户信息:', profile);
    return role;
  }, [profile?.role]);

  // 从数据库加载权限
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userRole) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('role_permission_templates')
          .select('menu_permissions, function_permissions, project_permissions, data_permissions')
          .eq('role', userRole)
          .single();

        if (error) {
          // Admin角色使用默认全权限
          if (userRole === 'admin') {
            logger.info('Admin角色使用默认全权限');
            setDbPermissions({
              menu_permissions: ['projects', 'business-entry', 'drivers', 'partners', 'locations', 'reports', 'finance-management', 'user-management', 'role-management', 'system-settings', 'all'],
              function_permissions: ['create', 'edit', 'delete', 'view', 'export', 'import', 'approve', 'reject', 'assign', 'unassign', 'all'],
              project_permissions: ['all', 'create', 'edit', 'delete', 'view', 'assign', 'approve'],
              data_permissions: ['all', 'own', 'team', 'department', 'company']
            });
            return;
          }
          
          safeLogger.warn('从数据库加载权限失败，使用默认权限:', error);
          setDbPermissions(null);
        } else {
          safeLogger.debug('从数据库加载权限成功:', data);
          setDbPermissions(data);
        }
      } catch (error) {
        safeLogger.error('加载权限失败:', error);
        setDbPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [userRole]);

  // 获取角色权限（优先使用数据库，智能回退）
  const rolePermissions = useMemo(() => {
    try {
      if (dbPermissions) {
        safeLogger.debug(`使用数据库权限: ${userRole}`, dbPermissions);
        return dbPermissions;
      } else {
        // 数据库加载失败时的回退策略
        safeLogger.log(`使用默认权限配置: ${userRole}`);
        return {
          menu_permissions: [],
          function_permissions: [],
          project_permissions: [],
          data_permissions: []
        };
      }
    } catch (error) {
      logger.error('获取角色权限失败:', error);
      return {
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: []
      };
    }
  }, [userRole, dbPermissions]);

  // 检查菜单权限
  const hasMenuAccess = (menuKey: string): boolean => {
    try {
      if (!menuKey) return false;
      
      // 管理员拥有所有权限
      if (userRole === 'admin') return true;
      
      if (!rolePermissions || !rolePermissions.menu_permissions) {
        safeLogger.debug('菜单权限检查失败 - 角色权限未加载:', menuKey);
        return false;
      }
      const hasAccess = rolePermissions.menu_permissions.includes(menuKey) || 
                       rolePermissions.menu_permissions.includes('all');
      safeLogger.permission('menu', menuKey, hasAccess);
      return hasAccess;
    } catch (error) {
      safeLogger.error('菜单权限检查失败:', error);
      return false;
    }
  };

  // 检查功能权限
  const hasFunctionAccess = (functionKey: string): boolean => {
    try {
      if (!functionKey) return false;
      
      // 管理员拥有所有权限
      if (userRole === 'admin') return true;
      
      if (!rolePermissions || !rolePermissions.function_permissions) {
        return false;
      }
      return rolePermissions.function_permissions.includes(functionKey) || 
             rolePermissions.function_permissions.includes('all');
    } catch (error) {
      logger.error('功能权限检查失败:', error);
      return false;
    }
  };

  // 检查项目权限
  const hasProjectAccess = (projectKey: string): boolean => {
    try {
      if (!projectKey) return false;
      
      // 管理员拥有所有权限
      if (userRole === 'admin') return true;
      
      if (!rolePermissions || !rolePermissions.project_permissions) {
        return false;
      }
      return rolePermissions.project_permissions.includes(projectKey) || 
             rolePermissions.project_permissions.includes('all');
    } catch (error) {
      logger.error('项目权限检查失败:', error);
      return false;
    }
  };

  // 检查数据权限
  const hasDataAccess = (dataKey: string): boolean => {
    try {
      if (!dataKey) return false;
      
      // 管理员拥有所有权限
      if (userRole === 'admin') return true;
      
      if (!rolePermissions || !rolePermissions.data_permissions) {
        return false;
      }
      return rolePermissions.data_permissions.includes(dataKey) || 
             rolePermissions.data_permissions.includes('all');
    } catch (error) {
      logger.error('数据权限检查失败:', error);
      return false;
    }
  };

  // 检查是否为管理员
  const isAdmin = useMemo(() => {
    const admin = userRole === 'admin';
    safeLogger.debug('用户是否为管理员:', admin);
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
