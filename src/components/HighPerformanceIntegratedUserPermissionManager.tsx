import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useHighPerformancePermissions } from '@/hooks/useHighPerformancePermissions';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Settings, 
  Shield, 
  Building2,
  RefreshCw,
  Save,
  Loader2,
  Database,
  Clock
} from 'lucide-react';
import { UserManagement } from './permissions/UserManagement';
import { PermissionConfiguration } from './permissions/PermissionConfiguration';
import { RoleTemplateManager } from './permissions/RoleTemplateManager';
import { ContractPermissionManager } from './contracts/ContractPermissionManagerEnhanced';
import { PermissionPerformanceMonitor } from './PermissionPerformanceMonitor';

export function HighPerformanceIntegratedUserPermissionManager() {
  const { toast } = useToast();
  const {
    loading,
    loadingProgress,
    roleTemplates,
    users,
    userPermissions,
    userPermissionsMap,
    projects,
    hasChanges,
    lastUpdateTime,
    setHasChanges,
    setRoleTemplates,
    setUserPermissions,
    savePermissions,
    refreshData,
    forceRefreshPermissions
  } = useHighPerformancePermissions();
  
  // 状态管理
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // 优化的用户权限合并
  const usersWithPermissions = useMemo(() => {
    if (!users.length) return [];
    
    return users.map(user => {
      const userPerms = userPermissionsMap.get(user.id) || {};
      const roleTemplate = roleTemplates[user.role] || {};
      
      return {
        ...user,
        permissions: {
          menu: userPerms.menu_permissions || roleTemplate.menu_permissions || [],
          function: userPerms.function_permissions || roleTemplate.function_permissions || [],
          project: userPerms.project_permissions || roleTemplate.project_permissions || [],
          data: userPerms.data_permissions || roleTemplate.data_permissions || []
        }
      };
    });
  }, [users, userPermissionsMap, roleTemplates]);

  // 优化的保存处理
  const handleSavePermissions = useCallback(async () => {
    try {
      await savePermissions(roleTemplates, userPermissions);
    } catch (error) {
      console.error('保存权限失败:', error);
    }
  }, [savePermissions, roleTemplates, userPermissions]);

  // 优化的重新加载
  const handleRefreshData = useCallback(async () => {
    try {
      await refreshData();
      toast({
        title: "刷新成功",
        description: "数据已重新加载",
      });
    } catch (error) {
      console.error('刷新失败:', error);
      toast({
        title: "刷新失败",
        description: "刷新数据失败",
        variant: "destructive"
      });
    }
  }, [refreshData, toast]);

  // 更新用户权限
  const handleSetUserPermissions = useCallback((permissions: Record<string, any>) => {
    setUserPermissions(permissions);
    setHasChanges(true);
  }, [setUserPermissions, setHasChanges]);

  // 更新角色模板
  const handleSetRoleTemplates = useCallback((templates: Record<string, any>) => {
    setRoleTemplates(templates);
    setHasChanges(true);
  }, [setRoleTemplates, setHasChanges]);

  // 加载状态显示
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              加载权限数据中...
            </CardTitle>
            <CardDescription>
              正在加载用户权限和角色模板数据
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={loadingProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {loadingProgress}% 完成
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 头部操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                集成权限管理
              </CardTitle>
              <CardDescription>
                统一管理用户权限、角色模板和合同权限
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                最后更新: {lastUpdateTime.toLocaleTimeString()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新数据
              </Button>
              <Button
                onClick={handleSavePermissions}
                disabled={!hasChanges || loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                保存更改
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 快速操作 */}
      <PermissionQuickActions
        users={usersWithPermissions}
        selectedUsers={selectedUsers}
        onSelectionChange={setSelectedUsers}
        onPermissionsChange={handleSetUserPermissions}
      />

      {/* 主要内容标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            角色模板
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            权限配置
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            合同权限
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            项目权限
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            性能监控
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UserManagement
            users={usersWithPermissions}
            roleTemplates={roleTemplates}
            projects={projects}
            onPermissionsChange={handleSetUserPermissions}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RoleTemplateManager
            roleTemplates={roleTemplates}
            onTemplatesChange={handleSetRoleTemplates}
          />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionConfiguration
            users={usersWithPermissions}
            roleTemplates={roleTemplates}
            onPermissionsChange={handleSetUserPermissions}
          />
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <ContractPermissionManager
            mode="global"
            onPermissionUpdate={handleRefreshData}
          />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>项目权限管理</CardTitle>
              <CardDescription>
                管理用户对特定项目的访问权限
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                项目权限管理功能开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PermissionPerformanceMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
