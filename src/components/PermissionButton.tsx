// 权限控制按钮组件

import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';
import { PermissionType } from '@/types/permissions';

interface PermissionButtonProps extends ButtonProps {
  permission: string;
  permissionType?: PermissionType;
  fallback?: React.ReactNode;
  requireAll?: boolean; // 是否需要所有权限
  permissions?: string[]; // 多个权限
}

export function PermissionButton({
  permission,
  permissionType = 'function',
  fallback = null,
  requireAll = false,
  permissions = [],
  children,
  ...props
}: PermissionButtonProps) {
  const { hasPermission } = useAdvancedPermissions();

  // 检查权限
  const checkPermission = () => {
    if (permissions.length > 0) {
      if (requireAll) {
        // 需要所有权限
        return permissions.every(p => hasPermission(p, permissionType).hasPermission);
      } else {
        // 需要任一权限
        return permissions.some(p => hasPermission(p, permissionType).hasPermission);
      }
    }
    return hasPermission(permission, permissionType).hasPermission;
  };

  const hasAccess = checkPermission();

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return (
    <Button {...props}>
      {children}
    </Button>
  );
}