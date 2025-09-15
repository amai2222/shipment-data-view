// 简化占位符组件
import React from 'react';

interface Props {
  title?: string;
  children?: React.ReactNode;
}

export function PermissionSection({ title, children }: Props) {
  return (
    <div className="p-4 border rounded">
      <h3 className="font-medium mb-2">{title}</h3>
      {children}
    </div>
  );
}