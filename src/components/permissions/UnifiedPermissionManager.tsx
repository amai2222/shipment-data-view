// 统一权限管理界面

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Settings2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PermissionQuickActions } from './PermissionQuickActions';
import { BatchPermissionOperations } from './BatchPermissionOperations';
import { PermissionTemplates } from './PermissionTemplates';
import { PermissionVisualization } from './PermissionVisualization';
import { RoleManagement } from './RoleManagement';
import { UserPermissionManagement } from './UserPermissionManagement';

interface UnifiedPermissionManagerProps {
  onPermissionChange?: () => void;
}

export function UnifiedPermissionManager({ onPermissionChange }: UnifiedPermissionManagerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('roles');
  const [loading, setLoading] = useState(false);
  
  // 数据状态
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      const [usersResult, projectsResult, roleTemplatesResult, userPermissionsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('role_permission_templates').select('*').order('updated_at', { ascending: false }),
        supabase.from('user_permissions').select('*')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (roleTemplatesResult.error) throw roleTemplatesResult.error;
      if (userPermissionsResult.error) throw userPermissionsResult.error;

      setUsers(usersResult.data || []);
      setProjects(projectsResult.data || []);
      setRoleTemplates(roleTemplatesResult.data || []);
      setUserPermissions(userPermissionsResult.data || []);

      // 强制刷新时输出调试信息
      if (forceRefresh) {
        console.log('强制刷新权限数据:', roleTemplatesResult.data);
        const operatorTemplate = roleTemplatesResult.data?.find(t => t.role === 'operator');
        if (operatorTemplate) {
          const totalCount = (operatorTemplate.menu_permissions?.length || 0) + 
                           (operatorTemplate.function_permissions?.length || 0) + 
                           (operatorTemplate.project_permissions?.length || 0) + 
                           (operatorTemplate.data_permissions?.length || 0);
          console.log('operator角色权限数量:', totalCount);
        }
      }

    } catch (error) {
      console.error('加载数据失败:', error);
      toast({
        title: "错误",
        description: "加载数据失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = () => {
    loadData();
    onPermissionChange?.();
  };

  const handleForceRefresh = async () => {
    try {
      await loadData(true);
      toast({
        title: "刷新完成",
        description: "权限数据已强制刷新",
      });
    } catch (error) {
      toast({
        title: "刷新失败", 
        description: "强制刷新数据时发生错误",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和快速操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">统一权限管理</h1>
          <p className="text-muted-foreground mt-2">
            集中管理系统角色权限、用户权限和批量操作
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={handleForceRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            强制刷新
          </Button>
        </div>
      </div>

      {/* 权限概览统计 */}
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
            <div className="text-2xl font-bold">{roleTemplates.length}</div>
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

      {/* 快速操作区域 */}
      <PermissionQuickActions 
        users={users}
        projects={projects}
        onDataChange={handleDataChange}
      />

      {/* 主要管理界面 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="roles">角色管理</TabsTrigger>
          <TabsTrigger value="users">用户权限</TabsTrigger>
          <TabsTrigger value="batch">批量操作</TabsTrigger>
          <TabsTrigger value="templates">权限模板</TabsTrigger>
          <TabsTrigger value="visualization">权限可视化</TabsTrigger>
          <TabsTrigger value="advanced">高级设置</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <RoleManagement 
            roleTemplates={roleTemplates}
            onDataChange={handleDataChange}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserPermissionManagement 
            users={users}
            projects={projects}
            userPermissions={userPermissions}
            roleTemplates={roleTemplates}
            onDataChange={handleDataChange}
          />
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <BatchPermissionOperations 
            users={users}
            projects={projects}
            onDataChange={handleDataChange}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <PermissionTemplates 
            roleTemplates={roleTemplates}
            onDataChange={handleDataChange}
          />
        </TabsContent>

        <TabsContent value="visualization" className="space-y-4">
          <PermissionVisualization 
            users={users}
            roleTemplates={roleTemplates}
            userPermissions={userPermissions}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>高级设置</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">高级权限设置功能正在开发中...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}