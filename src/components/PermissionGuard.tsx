// 权限守卫组件
// 用于控制组件的显示，替代硬编码的角色判断
import React from 'react';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  // 支持多种权限检查方式
  requireMenu?: string | string[];
  requireFunction?: string | string[];
  requireOperation?: string | string[];
  requireRole?: string | string[];  // 兼容：基于角色
  requireAdmin?: boolean;  // 兼容：要求 admin
  requireAny?: boolean;  // true: 满足任一即可，false: 需要全部满足
  fallback?: React.ReactNode;  // 无权限时显示的内容
}

export function PermissionGuard({
  children,
  requireMenu,
  requireFunction,
  requireOperation,
  requireRole,
  requireAdmin = false,
  requireAny = false,
  fallback = null
}: PermissionGuardProps) {
  const {
    hasMenuAccess,
    hasFunctionAccess,
    hasOperationAccess,
    hasRole,
    isAdmin
  } = useUnifiedPermissions();

  // 检查 admin 要求
  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>;
  }

  // 检查角色要求（兼容模式）
  if (requireRole) {
    if (!hasRole(requireRole)) {
      return <>{fallback}</>;
    }
  }

  // 收集所有权限检查
  const permissionChecks: boolean[] = [];

  // 检查菜单权限
  if (requireMenu) {
    const menuKeys = Array.isArray(requireMenu) ? requireMenu : [requireMenu];
    const results = menuKeys.map(key => hasMenuAccess(key));
    permissionChecks.push(...results);
  }

  // 检查功能权限
  if (requireFunction) {
    const functionKeys = Array.isArray(requireFunction) ? requireFunction : [requireFunction];
    const results = functionKeys.map(key => hasFunctionAccess(key));
    permissionChecks.push(...results);
  }

  // 检查操作权限
  if (requireOperation) {
    const operationKeys = Array.isArray(requireOperation) ? requireOperation : [requireOperation];
    const results = operationKeys.map(key => hasOperationAccess(key));
    permissionChecks.push(...results);
  }

  // 判断是否有权限
  if (permissionChecks.length > 0) {
    const hasPermission = requireAny 
      ? permissionChecks.some(check => check)  // 满足任一
      : permissionChecks.every(check => check);  // 需要全部

    if (!hasPermission) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

// 便捷组件
export function AdminOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <PermissionGuard requireAdmin fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function MenuGuard({ 
  menuKey, 
  children, 
  fallback = null 
}: { 
  menuKey: string | string[]; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard requireMenu={menuKey} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function FunctionGuard({ 
  functionKey, 
  children, 
  fallback = null 
}: { 
  functionKey: string | string[]; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard requireFunction={functionKey} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

