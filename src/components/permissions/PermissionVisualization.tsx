import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PermissionVisualizationProps {
  users?: any[];
  roleTemplates?: any[];
  userPermissions?: any[];
}

export function PermissionVisualization({ users, roleTemplates, userPermissions }: PermissionVisualizationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>权限可视化</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">权限可视化功能正在开发中...</p>
      </CardContent>
    </Card>
  );
}