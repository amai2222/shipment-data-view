// 简化占位符组件
import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  permissionType?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export function PermissionButton({ children, onClick }: Props) {
  return (
    <Button onClick={onClick}>
      {children}
    </Button>
  );
}