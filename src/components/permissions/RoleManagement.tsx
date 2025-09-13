import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RoleManagementProps {
  roleTemplates?: any[];
  onDataChange?: () => void;
}

export function RoleManagement({ roleTemplates, onDataChange }: RoleManagementProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>角色管理</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">角色管理功能正在开发中...</p>
      </CardContent>
    </Card>
  );
}