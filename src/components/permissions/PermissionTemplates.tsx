import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PermissionTemplatesProps {
  roleTemplates?: any[];
  onDataChange?: () => void;
}

export function PermissionTemplates({ roleTemplates, onDataChange }: PermissionTemplatesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>权限模板</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">权限模板功能正在开发中...</p>
      </CardContent>
    </Card>
  );
}