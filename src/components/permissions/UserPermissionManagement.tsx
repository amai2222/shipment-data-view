import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserPermissionManagementProps {
  users?: any[];
  projects?: any[];
  userPermissions?: any[];
  roleTemplates?: any[];
  onDataChange?: () => void;
}

export function UserPermissionManagement({ 
  users, 
  projects, 
  userPermissions, 
  roleTemplates, 
  onDataChange 
}: UserPermissionManagementProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>用户权限管理</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">用户权限管理功能正在开发中...</p>
      </CardContent>
    </Card>
  );
}