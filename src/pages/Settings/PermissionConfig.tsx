import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  RefreshCw, 
  Save,
  Users,
  Settings
} from 'lucide-react';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { PermissionConfiguration } from '@/components/permissions/PermissionConfiguration';
import { PageHeader } from '@/components/PageHeader';

export default function PermissionConfigPage() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const {
    loading,
    users,
    roleTemplates,
    userPermissions,
    loadAllData,
    savePermissions
  } = useOptimizedPermissions();

  // 将roleTemplates对象转换为数组
  const roleTemplatesArray = Array.isArray(roleTemplates) 
    ? roleTemplates 
    : Object.values(roleTemplates || {});

  // 合并用户和权限数据
  const usersWithPermissions = useMemo(() => {
    return users.map(user => {
      // userPermissions 是数组，需要找到对应用户的权限记录
      const userPermission = userPermissions.find(perm => perm.user_id === user.id);
      const permissions = userPermission ? {
        menu: userPermission.menu_permissions || [],
        function: userPermission.function_permissions || [],
        project: userPermission.project_permissions || [],
        data: userPermission.data_permissions || []
      } : {};
      return {
        ...user,
        permissions
      };
    });
  }, [users, userPermissions]);

  // 处理保存权限
  const handleSavePermissions = async () => {
    try {
      await savePermissions();
      setHasChanges(false);
      toast({
        title: "保存成功",
        description: "权限配置已保存",
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: "无法保存权限配置",
        variant: "destructive",
      });
    }
  };

  // 处理加载数据
  const handleLoadData = async () => {
    try {
      await loadAllData();
      toast({
        title: "刷新成功",
        description: "权限数据已刷新",
      });
    } catch (error) {
      toast({
        title: "刷新失败",
        description: "无法刷新权限数据",
        variant: "destructive",
      });
    }
  };

  // 处理权限变化
  const handleSetUserPermissions = (userId: string, permissions: any) => {
    setHasChanges(true);
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="权限配置"
        description="配置用户权限和角色模板"
        icon={Shield}
        iconColor="text-blue-600"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button
          size="sm"
          onClick={handleSavePermissions}
          disabled={!hasChanges || loading}
        >
          <Save className="h-4 w-4 mr-2" />
          保存
        </Button>
      </PageHeader>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">角色模板</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleTemplatesArray.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">权限配置</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userPermissions.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">状态</CardTitle>
            <Badge variant={hasChanges ? "destructive" : "default"}>
              {hasChanges ? "有未保存更改" : "已保存"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {hasChanges ? "请保存更改" : "所有更改已保存"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 权限配置组件 */}
      <Card>
        <CardContent>
          <PermissionConfiguration
            users={usersWithPermissions}
            roleTemplates={roleTemplatesArray}
            userPermissions={userPermissions}
            hasChanges={hasChanges}
            onSave={handleSavePermissions}
            onLoadData={handleLoadData}
            onSetHasChanges={setHasChanges}
            onSetUserPermissions={handleSetUserPermissions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
