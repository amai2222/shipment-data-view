import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PermissionQuickActionsProps {
  users?: any[];
  projects?: any[];
  onDataChange?: () => void;
}

export function PermissionQuickActions({ users, projects, onDataChange }: PermissionQuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>快速操作</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">权限快速操作功能正在开发中...</p>
      </CardContent>
    </Card>
  );
}