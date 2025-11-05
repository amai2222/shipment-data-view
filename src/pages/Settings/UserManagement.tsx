import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Search, 
  RefreshCw, 
  UserPlus,
  Edit,
  Trash2,
  Shield,
  Building2
} from 'lucide-react';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { UserManagement } from '@/components/permissions/UserManagement';
import { PermissionQuickActions } from '@/components/PermissionQuickActions';
import { PermissionResetService } from '@/services/PermissionResetService';
import { PageHeader } from '@/components/PageHeader';

export default function UserManagementPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const {
    loading,
    users,
    roleTemplates,
    userPermissions,
    loadAllData,
    savePermissions
  } = useOptimizedPermissions();

  // 合并用户和权限数据
  const usersWithPermissions = useMemo(() => {
    return users.map(user => {
      const permissions = userPermissions[user.id] || {};
      return {
        ...user,
        permissions
      };
    });
  }, [users, userPermissions]);

  // 处理用户更新
  const handleUserUpdate = async () => {
    try {
      await loadAllData();
      toast({
        title: "更新成功",
        description: "用户信息已更新",
      });
    } catch (error) {
      toast({
        title: "更新失败",
        description: "无法更新用户信息",
        variant: "destructive",
      });
    }
  };

  // 批量权限更新处理
  const handleBulkPermissionUpdate = async (action: string, data: any) => {
    try {
      console.log('批量权限更新:', action, data);
      
      if (action === 'change-role' && data.role) {
        // 批量修改角色
        const { error } = await supabase
          .from('profiles')
          .update({ role: data.role })
          .in('id', selectedUsers);
        
        if (error) throw error;
        
        toast({
          title: "批量更新成功",
          description: `已将 ${selectedUsers.length} 个用户的角色更新为 ${data.role}`,
        });
        
        await loadAllData();
      } else if (action === 'apply-template' && data.template) {
        // 应用模板：删除自定义权限，让用户使用角色模板
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .in('user_id', selectedUsers)
          .is('project_id', null);
        
        if (error) throw error;
        
        toast({
          title: "模板应用成功",
          description: `已将 ${selectedUsers.length} 个用户重置为角色模板权限`,
        });
        
        await loadAllData();
      }
    } catch (error: any) {
      console.error('批量操作失败:', error);
      toast({
        title: "操作失败",
        description: error.message || `批量${action}操作失败`,
        variant: "destructive",
      });
    }
  };

  // 复制权限处理
  const handleCopyPermissions = async (fromUserId: string, toUserIds: string[]) => {
    try {
      console.log('复制权限:', fromUserId, toUserIds);
      
      // 1. 获取源用户的权限配置
      const { data: sourcePermissions, error: fetchError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', fromUserId)
        .is('project_id', null)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (!sourcePermissions) {
        toast({
          title: "提示",
          description: "源用户没有自定义权限，使用角色模板",
        });
        return;
      }
      
      // 2. 复制到目标用户
      const permissionsToInsert = toUserIds.map(userId => ({
        user_id: userId,
        project_id: null,
        menu_permissions: sourcePermissions.menu_permissions || [],
        function_permissions: sourcePermissions.function_permissions || [],
        project_permissions: sourcePermissions.project_permissions || [],
        data_permissions: sourcePermissions.data_permissions || [],
        created_by: fromUserId
      }));
      
      // 先删除目标用户的现有权限
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .in('user_id', toUserIds)
        .is('project_id', null);
      
      if (deleteError) throw deleteError;
      
      // 插入新权限
      const { error: insertError } = await supabase
        .from('user_permissions')
        .insert(permissionsToInsert);
      
      if (insertError) throw insertError;
      
      toast({
        title: "复制成功",
        description: `权限已从用户复制到 ${toUserIds.length} 个用户`,
      });
      
      await loadAllData();
    } catch (error: any) {
      console.error('复制权限失败:', error);
      toast({
        title: "复制失败",
        description: error.message || "权限复制失败",
        variant: "destructive",
      });
    }
  };

  // 重置权限处理 - 使用专门的重置服务
  const handleResetToRole = async (userIds: string[]) => {
    try {
      console.log('开始重置权限:', userIds);
      
      // 使用专门的重置服务，这是唯一可以使用硬编码权限的地方
      await PermissionResetService.resetMultipleUsersToRoleDefault(userIds);
      
      toast({
        title: "重置成功",
        description: `${userIds.length}个用户的权限已重置为角色默认权限`,
      });

      // 刷新数据
      await loadAllData();
    } catch (error) {
      console.error('重置权限失败:', error);
      toast({
        title: "重置失败",
        description: "权限重置失败",
        variant: "destructive",
      });
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-muted-foreground">加载用户数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="用户管理"
        description="管理系统用户信息、角色和权限"
        icon={Users}
        iconColor="text-blue-600"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUserUpdate}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
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
            <CardTitle className="text-sm font-medium">管理员</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(user => user.role === 'admin').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">业务员</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(user => user.role === 'business').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">财务员</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(user => user.role === 'finance').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* 快速操作组件 */}
      <PermissionQuickActions
        hasChanges={false}
        onSave={() => {}}
        onReload={handleUserUpdate}
        users={users}
        selectedUsers={selectedUsers}
        onBulkPermissionUpdate={handleBulkPermissionUpdate}
        onCopyPermissions={handleCopyPermissions}
        onResetToRole={handleResetToRole}
      />

      {/* 用户管理组件 */}
      <Card>
        <CardContent>
          <UserManagement
            users={usersWithPermissions}
            loading={loading}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            onUserUpdate={handleUserUpdate}
            roleTemplates={roleTemplates}
          />
        </CardContent>
      </Card>
    </div>
  );
}
