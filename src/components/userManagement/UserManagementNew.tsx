// 新的用户管理主组件

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, AlertCircle, Users } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserDialog } from './UserDialog';
import { UserList } from './UserList';
import { BatchOperations } from './BatchOperations';
import { User, UserCreateData, UserUpdateData } from '@/types/userManagement';

export function UserManagementNew() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const {
    users,
    loading,
    error,
    selectedUsers,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    batchUpdateUserRoles,
    batchUpdateUserStatus,
    batchDeleteUsers,
    selectUser,
    unselectUser,
    toggleSelectAll,
    clearSelection
  } = useUserManagement();

  // 处理用户选择
  const handleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      unselectUser(userId);
    } else {
      selectUser(userId);
    }
  };

  // 处理创建用户
  const handleCreateUser = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  // 处理编辑用户
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  // 处理保存用户
  const handleSaveUser = async (data: UserCreateData | UserUpdateData) => {
    const result = editingUser 
      ? await updateUser(data as UserUpdateData)
      : await createUser(data as UserCreateData);
    
    return result;
  };

  // 处理删除用户
  const handleDeleteUser = async (userId: string) => {
    const result = await deleteUser(userId);
    
    if (result.success) {
      toast({
        title: "成功",
        description: result.message
      });
    } else {
      toast({
        title: "错误",
        description: result.message,
        variant: "destructive"
      });
    }
  };

  // 处理批量更新角色
  const handleBatchUpdateRoles = async (userIds: string[], role: any) => {
    const result = await batchUpdateUserRoles(userIds, role);
    
    if (result.success) {
      toast({
        title: "成功",
        description: result.message
      });
      clearSelection();
    } else {
      toast({
        title: "错误",
        description: result.message,
        variant: "destructive"
      });
    }
  };

  // 处理批量更新状态
  const handleBatchUpdateStatus = async (userIds: string[], isActive: boolean) => {
    const result = await batchUpdateUserStatus(userIds, isActive);
    
    if (result.success) {
      toast({
        title: "成功",
        description: result.message
      });
      clearSelection();
    } else {
      toast({
        title: "错误",
        description: result.message,
        variant: "destructive"
      });
    }
  };

  // 处理批量删除用户
  const handleBatchDeleteUsers = async (userIds: string[]) => {
    const result = await batchDeleteUsers(userIds);
    
    if (result.success) {
      toast({
        title: "成功",
        description: result.message
      });
      clearSelection();
    } else {
      toast({
        title: "错误",
        description: result.message,
        variant: "destructive"
      });
    }
  };

  // 处理强制刷新
  const handleForceRefresh = async () => {
    try {
      await loadUsers();
      toast({
        title: "刷新完成",
        description: "用户数据已刷新",
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
            <span>加载用户数据失败: {error}</span>
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
          <h1 className="text-3xl font-bold">用户管理</h1>
          <p className="text-muted-foreground mt-2">
            管理系统用户账户和权限
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
            <CardTitle className="text-sm font-medium">启用用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.is_active).length}</div>
            <p className="text-xs text-muted-foreground">当前启用的用户</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已选择</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedUsers.length}</div>
            <p className="text-xs text-muted-foreground">当前选择的用户</p>
          </CardContent>
        </Card>
      </div>

      {/* 批量操作 */}
      <BatchOperations
        selectedUsers={selectedUsers}
        onBatchUpdateRoles={handleBatchUpdateRoles}
        onBatchUpdateStatus={handleBatchUpdateStatus}
        onBatchDeleteUsers={handleBatchDeleteUsers}
        loading={loading}
      />

      {/* 用户列表 */}
      <UserList
        users={users}
        selectedUsers={selectedUsers}
        onSelectUser={handleSelectUser}
        onSelectAll={toggleSelectAll}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
        onCreateUser={handleCreateUser}
        loading={loading}
      />

      {/* 用户对话框 */}
      <UserDialog
        user={editingUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveUser}
        loading={loading}
      />
    </div>
  );
}
