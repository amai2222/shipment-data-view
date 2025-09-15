import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useSimplePermissions } from '@/hooks/useSimplePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DebugPermissions() {
  const { hasMenuAccess, isAdmin, userRole, rolePermissions } = useSimplePermissions();

  return (
    <AppLayout>
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>权限调试信息</CardTitle>
            <CardDescription>查看当前用户的权限状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold">用户信息</h3>
              <p>角色: <Badge>{userRole}</Badge></p>
              <p>是否管理员: <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "是" : "否"}</Badge></p>
            </div>
            
            <div>
              <h3 className="font-semibold">菜单权限检查</h3>
              <div className="space-y-2">
                <p>settings: <Badge variant={hasMenuAccess('settings') ? "default" : "secondary"}>{hasMenuAccess('settings') ? "有权限" : "无权限"}</Badge></p>
                <p>settings.integrated: <Badge variant={hasMenuAccess('settings.integrated') ? "default" : "secondary"}>{hasMenuAccess('settings.integrated') ? "有权限" : "无权限"}</Badge></p>
                <p>settings.audit_logs: <Badge variant={hasMenuAccess('settings.audit_logs') ? "default" : "secondary"}>{hasMenuAccess('settings.audit_logs') ? "有权限" : "无权限"}</Badge></p>
                <p>settings.permissions: <Badge variant={hasMenuAccess('settings.permissions') ? "default" : "secondary"}>{hasMenuAccess('settings.permissions') ? "有权限" : "无权限"}</Badge></p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold">角色权限</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(rolePermissions, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
