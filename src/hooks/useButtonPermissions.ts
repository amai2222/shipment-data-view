import { useMenuPermissions } from './useMenuPermissions';
import { usePermissions } from './usePermissions';

/**
 * 按钮权限控制 Hook
 * 提供便捷的按钮权限检查方法
 */
export function useButtonPermissions() {
  const { hasFunctionAccess } = useMenuPermissions();
  const { role, isAdmin } = usePermissions();

  /**
   * 检查是否有特定功能的权限
   */
  const canExecuteFunction = (functionKey: string): boolean => {
    if (isAdmin) return true;
    return hasFunctionAccess(functionKey);
  };

  /**
   * 检查是否有特定角色权限
   */
  const hasRole = (requiredRoles: string | string[]): boolean => {
    if (isAdmin) return true;
    if (!role) return false;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(role);
  };

  /**
   * 综合权限检查：角色 + 功能
   */
  const canAccess = (options: {
    roles?: string | string[];
    functions?: string | string[];
  }): boolean => {
    if (isAdmin) return true;

    // 检查角色权限
    if (options.roles && !hasRole(options.roles)) {
      return false;
    }

    // 检查功能权限
    if (options.functions) {
      const functions = Array.isArray(options.functions) ? options.functions : [options.functions];
      return functions.some(func => hasFunctionAccess(func));
    }

    return true;
  };

  return {
    canExecuteFunction,
    hasRole,
    canAccess,
    isAdmin,
    role
  };
}