import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionButtonProps extends ButtonProps {
  requiredFunction?: string;
  requiredRole?: string | string[];
  children: React.ReactNode;
}

/**
 * 权限控制按钮组件
 * 根据用户权限决定是否显示按钮
 */
export function PermissionButton({ 
  requiredFunction, 
  requiredRole, 
  children, 
  ...props 
}: PermissionButtonProps) {
  const { hasFunctionAccess } = useMenuPermissions();
  const { role } = usePermissions();

  // 检查功能权限
  if (requiredFunction && !hasFunctionAccess(requiredFunction)) {
    return null;
  }

  // 检查角色权限
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!role || !roles.includes(role)) {
      return null;
    }
  }

  return (
    <Button {...props}>
      {children}
    </Button>
  );
}