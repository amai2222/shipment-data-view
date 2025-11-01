// 统一权限管理 Hook
// 提供一致的权限检查接口，替代硬编码的角色判断
import { useSimplePermissions } from './useSimplePermissions';

export function useUnifiedPermissions() {
  const { 
    hasMenuAccess, 
    hasFunctionAccess, 
    hasProjectAccess,
    hasDataAccess,
    isAdmin, 
    userRole,
    rolePermissions,
    loading
  } = useSimplePermissions();

  // 检查是否有按钮权限（用于控制按钮显示）
  const hasButtonAccess = (buttonKey: string): boolean => {
    // admin 拥有所有权限
    if (isAdmin) return true;
    
    // 检查功能权限
    return hasFunctionAccess(buttonKey);
  };

  // 检查是否有页面访问权限（用于路由保护）
  const hasPageAccess = (pageKey: string): boolean => {
    if (isAdmin) return true;
    return hasMenuAccess(pageKey);
  };

  // 检查是否有操作权限（用于控制操作显示）
  const hasOperationAccess = (operationKey: string): boolean => {
    if (isAdmin) return true;
    return hasFunctionAccess(operationKey);
  };

  // 替代 isAdmin 的角色检查（兼容旧代码）
  const hasRole = (roles: string | string[]): boolean => {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(userRole);
  };

  // 检查是否有任一权限（或运算）
  const hasAnyPermission = (...permissionKeys: string[]): boolean => {
    if (isAdmin) return true;
    return permissionKeys.some(key => 
      hasMenuAccess(key) || hasFunctionAccess(key)
    );
  };

  // 检查是否有所有权限（与运算）
  const hasAllPermissions = (...permissionKeys: string[]): boolean => {
    if (isAdmin) return true;
    return permissionKeys.every(key => 
      hasMenuAccess(key) || hasFunctionAccess(key)
    );
  };

  return {
    // 基础权限检查
    hasMenuAccess,
    hasFunctionAccess,
    hasProjectAccess,
    hasDataAccess,
    
    // 扩展权限检查
    hasButtonAccess,
    hasPageAccess,
    hasOperationAccess,
    
    // 角色相关（兼容）
    isAdmin,
    userRole,
    hasRole,
    
    // 高级组合
    hasAnyPermission,
    hasAllPermissions,
    
    // 其他
    rolePermissions,
    loading
  };
}

// 导出为默认
export default useUnifiedPermissions;

