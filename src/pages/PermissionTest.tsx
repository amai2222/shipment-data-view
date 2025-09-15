import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSimplePermissions } from '@/hooks/useSimplePermissions';

export default function PermissionTestPage() {
  const { hasMenuAccess, isAdmin, userRole, rolePermissions } = useSimplePermissions();

  const permissionsToTest = [
    'settings',
    'settings.users',
    'settings.permissions',
    'settings.contract_permissions',
    'settings.role_templates',
    'settings.integrated',
    'settings.audit_logs'
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>权限测试页面</CardTitle>
          <CardDescription>测试新添加的设置页面权限</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">用户信息</h3>
            <p>角色: <Badge variant="default">{userRole}</Badge></p>
            <p>是否管理员: <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "是" : "否"}</Badge></p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">权限检查</h3>
            <div className="space-y-2">
              {permissionsToTest.map(permission => (
                <div key={permission} className="flex items-center justify-between">
                  <span className="text-sm">{permission}:</span>
                  <Badge variant={hasMenuAccess(permission) ? "default" : "secondary"}>
                    {hasMenuAccess(permission) ? "有权限" : "无权限"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">角色权限详情</h3>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(rolePermissions, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
