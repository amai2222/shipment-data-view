// 简化的统一权限管理界面

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Settings2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UnifiedPermissionManagerProps {
  onPermissionChange?: () => void;
}

export function UnifiedPermissionManager({ onPermissionChange }: UnifiedPermissionManagerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  
  // 数据状态
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [usersResult, projectsResult, userPermissionsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('user_permissions').select('*')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (userPermissionsResult.error) throw userPermissionsResult.error;

      setUsers(usersResult.data || []);
      setProjects(projectsResult.data || []);
      setUserPermissions(userPermissionsResult.data || []);

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
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">统一权限管理</h1>
          <p className="text-muted-foreground mt-2">
            集中管理系统用户权限和批量操作
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 权限概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* 简化的管理界面 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">用户权限</TabsTrigger>
          <TabsTrigger value="settings">系统设置</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>用户权限管理</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                请使用现有的权限管理界面进行详细配置。此处为简化视图。
              </p>
              <div className="mt-4">
                <Button onClick={() => window.location.href = '/settings/permissions'}>
                  前往详细权限管理
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>系统设置</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">系统设置功能正在开发中...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}