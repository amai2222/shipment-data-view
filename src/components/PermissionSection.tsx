import React from 'react';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionSectionProps {
  requiredFunction?: string;
  requiredRole?: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 权限控制区域组件
 * 根据用户权限决定是否显示内容区域
 */
export function PermissionSection({ 
  requiredFunction, 
  requiredRole, 
  fallback = null,
  children 
}: PermissionSectionProps) {
  const { hasFunctionAccess } = useMenuPermissions();
  const { role } = usePermissions();

  // 检查功能权限
  if (requiredFunction && !hasFunctionAccess(requiredFunction)) {
    return <>{fallback}</>;
  }

  // 检查角色权限
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!role || !roles.includes(role)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}