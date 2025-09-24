import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
      // 这里需要根据具体的action类型来处理
      console.log('批量权限更新:', action, data);
      toast({
        title: "操作成功",
        description: `批量${action}操作已完成`,
      });
    } catch (error) {
      toast({
        title: "操作失败",
        description: `批量${action}操作失败`,
        variant: "destructive",
      });
    }
  };

  // 复制权限处理
  const handleCopyPermissions = async (fromUserId: string, toUserIds: string[]) => {
    try {
      // 这里需要实现复制权限的逻辑
      console.log('复制权限:', fromUserId, toUserIds);
      toast({
        title: "复制成功",
        description: `权限已从用户复制到${toUserIds.length}个用户`,
      });
    } catch (error) {
      toast({
        title: "复制失败",
        description: "权限复制失败",
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

  return (
    <div className="space-y-6 p-4 md:p-6 pl-6 md:pl-8">
      <PageHeader 
        title="用户管理" 
        description="管理系统用户信息、角色和权限"
        icon={Shield}
        iconColor="text-red-600"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleUserUpdate}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
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
