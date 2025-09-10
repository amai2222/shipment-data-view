// 增强的权限管理页面

import React from 'react';
import { PermissionManager } from '@/components/PermissionManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';
import { Shield, Users, Settings, BarChart3 } from 'lucide-react';

export default function EnhancedPermissionManagement() {
  const { permissionContext, loading } = useAdvancedPermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载权限数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">权限管理系统</h1>
          <p className="text-muted-foreground mt-2">
            管理用户角色权限和个性化设置
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          当前用户: {permissionContext.userRole}
        </Badge>
      </div>

      {/* 权限概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">菜单权限</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissionContext.permissions.menu.length}</div>
            <p className="text-xs text-muted-foreground">
              可访问的菜单项
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">功能权限</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissionContext.permissions.function.length}</div>
            <p className="text-xs text-muted-foreground">
              可执行的功能
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">项目权限</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissionContext.permissions.project.length}</div>
            <p className="text-xs text-muted-foreground">
              项目相关权限
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">数据权限</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissionContext.permissions.data.length}</div>
            <p className="text-xs text-muted-foreground">
              数据访问权限
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 权限管理器 */}
      <PermissionManager 
        onPermissionChange={() => {
          // 权限变更后刷新页面或重新加载权限
          window.location.reload();
        }}
      />
    </div>
  );
}
