// 权限控制区域组件

import React from 'react';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';

type PermissionType = 'menu' | 'function' | 'project' | 'data';

interface PermissionSectionProps {
  permission: string;
  permissionType?: PermissionType;
  fallback?: React.ReactNode;
  requireAll?: boolean;
  permissions?: string[];
  children: React.ReactNode;
}

export function PermissionSection({
  permission,
  permissionType = 'function',
  fallback = null,
  requireAll = false,
  permissions = [],
  children
}: PermissionSectionProps) {
  const { hasPermission } = useAdvancedPermissions();

  // 检查权限
  const checkPermission = () => {
    if (permissions.length > 0) {
      if (requireAll) {
        return permissions.every(p => hasPermission(p, permissionType).hasPermission);
      } else {
        return permissions.some(p => hasPermission(p, permissionType).hasPermission);
      }
    }
    return hasPermission(permission, permissionType).hasPermission;
  };

  const hasAccess = checkPermission();

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}