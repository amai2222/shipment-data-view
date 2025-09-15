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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">
            管理系统用户信息、角色和权限
          </p>
        </div>
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
      </div>

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
