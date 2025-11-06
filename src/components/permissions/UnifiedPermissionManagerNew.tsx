// 新的统一权限管理组件

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Settings2, RefreshCw, AlertCircle } from 'lucide-react';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { RoleManagementNew } from './RoleManagementNew';
import { UserPermissionManagementNew } from './UserPermissionManagementNew';

interface UnifiedPermissionManagerNewProps {
  onPermissionChange?: () => void;
}

export function UnifiedPermissionManagerNew({ onPermissionChange }: UnifiedPermissionManagerNewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('roles');
  
  const {
    users,
    projects,
    roleTemplates,
    userPermissions,
    loading,
    error,
    loadData,
    saveRoleTemplate,
    saveUserPermission,
    deleteUserPermission,
    batchUpdateUserRoles,
    batchUpdateUserStatus,
    getUserEffectivePermissions
  } = usePermissionManager();

  // 处理权限变更
  const handlePermissionChange = () => {
    onPermissionChange?.();
    toast({
      title: "权限已更新",
      description: "权限变更已生效",
    });
  };

  // 强制刷新
  const handleForceRefresh = async () => {
    try {
      await loadData();
      toast({
        title: "刷新完成",
        description: "权限数据已刷新",
      });
    } catch (error: any) {
      toast({
        title: "刷新失败",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>加载权限数据失败: {error}</span>
          </div>
          <Button onClick={handleForceRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和统计 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">权限管理系统</h1>
          <p className="text-muted-foreground mt-2">
            统一管理角色权限和用户权限
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleForceRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">系统用户总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">角色模板</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(roleTemplates).length}</div>
            <p className="text-xs text-muted-foreground">已配置的角色</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自定义权限</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userPermissions.length}</div>
            <p className="text-xs text-muted-foreground">用户特殊权限</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">项目数量</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">管理的项目</p>
          </CardContent>
        </Card>
      </div>

      {/* 主要管理界面 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="roles" className="flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            角色管理
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            用户权限
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <RoleManagementNew 
            roleTemplates={Object.values(roleTemplates)}
            onDataChange={loadData}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserPermissionManagementNew 
            users={users}
            projects={projects}
            userPermissions={userPermissions}
            onDataChange={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
