import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BatchPermissionOperationsProps {
  users?: any[];
  projects?: any[];
  onDataChange?: () => void;
}

export function BatchPermissionOperations({ users, projects, onDataChange }: BatchPermissionOperationsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>批量权限操作</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">批量权限操作功能正在开发中...</p>
      </CardContent>
    </Card>
  );
}