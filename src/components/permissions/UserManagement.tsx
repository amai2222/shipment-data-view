import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Copy,
  Key,
  Shield,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { UserWithPermissions, UserRole } from '@/types/permissions';

interface UserManagementProps {
  users: UserWithPermissions[];
  loading: boolean;
  selectedUsers: string[];
  onSelectionChange: (selected: string[]) => void;
  onUserUpdate: () => void;
}

export function UserManagement({ 
  users, 
  loading, 
  selectedUsers, 
  onSelectionChange, 
  onUserUpdate 
}: UserManagementProps) {
  const { toast } = useToast();
  
  // 状态管理
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [showBulkRoleDialog, setShowBulkRoleDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithPermissions | null>(null);
  const [bulkRole, setBulkRole] = useState('');
  
  // 表单数据
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'viewer' as UserRole
  });

  // 创建用户
  const handleCreateUser = async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: createUserForm.email,
        password: createUserForm.password,
        email_confirm: true
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: createUserForm.full_name,
          email: createUserForm.email,
          role: createUserForm.role,
          is_active: true
        });

      if (profileError) throw profileError;

      toast({
        title: "创建成功",
        description: "用户已成功创建",
      });

      setShowCreateUserDialog(false);
      setCreateUserForm({ email: '', password: '', full_name: '', role: 'viewer' });
      onUserUpdate();
    } catch (error: any) {
      console.error('创建用户失败:', error);
      toast({
        title: "创建失败",
        description: error.message || "创建用户失败",
        variant: "destructive"
      });
    }
  };

  // 切换用户状态
  const toggleUserStatus = (user: UserWithPermissions) => {
    setUserToDelete(user);
    setShowStatusChangeDialog(true);
  };

  const confirmToggleUserStatus = async () => {
    if (!userToDelete) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !userToDelete.is_active })
        .eq('id', userToDelete.id);

      if (error) throw error;

      toast({
        title: "状态更新成功",
        description: `用户已${userToDelete.is_active ? '禁用' : '启用'}`,
      });

      setShowStatusChangeDialog(false);
      setUserToDelete(null);
      onUserUpdate();
    } catch (error: any) {
      console.error('更新用户状态失败:', error);
      toast({
        title: "更新失败",
        description: "更新用户状态失败",
        variant: "destructive"
      });
    }
  };

  // 批量操作
  const handleBulkStatusChange = async (isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "批量操作成功",
        description: `已${isActive ? '启用' : '禁用'} ${selectedUsers.length} 个用户`,
      });

      onSelectionChange([]);
      onUserUpdate();
    } catch (error: any) {
      console.error('批量操作失败:', error);
      toast({
        title: "操作失败",
        description: "批量操作失败",
        variant: "destructive"
      });
    }
  };

  const handleBulkRoleChange = async () => {
    if (!bulkRole) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: bulkRole })
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "批量操作成功",
        description: `已将 ${selectedUsers.length} 个用户的角色更改为 ${bulkRole}`,
      });

      setShowBulkRoleDialog(false);
      setBulkRole('');
      onSelectionChange([]);
      onUserUpdate();
    } catch (error: any) {
      console.error('批量操作失败:', error);
      toast({
        title: "操作失败",
        description: "批量操作失败",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "批量删除成功",
        description: `已删除 ${selectedUsers.length} 个用户`,
      });

      setShowBulkDeleteDialog(false);
      onSelectionChange([]);
      onUserUpdate();
    } catch (error: any) {
      console.error('批量删除失败:', error);
      toast({
        title: "删除失败",
        description: "批量删除失败",
        variant: "destructive"
      });
    }
  };

  // 获取权限统计
  const getPermissionCount = (user: UserWithPermissions) => {
    if (!user.permissions) return 0;
    return (
      (user.permissions.menu?.length || 0) +
      (user.permissions.function?.length || 0) +
      (user.permissions.project?.length || 0) +
      (user.permissions.data?.length || 0)
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载用户数据中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>
                管理用户信息、角色和权限
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* 批量操作按钮 */}
              {selectedUsers.length > 0 && (
                <div className="flex items-center gap-2 mr-4">
                  <Badge variant="secondary" className="text-sm">
                    已选择 {selectedUsers.length} 个用户
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusChange(true)}
                  >
                    批量启用
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusChange(false)}
                  >
                    批量禁用
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkRoleDialog(true)}
                  >
                    批量改角色
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    className="text-red-600 hover:text-red-700"
                  >
                    批量删除
                  </Button>
                </div>
              )}
              
              <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新建用户
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建新用户</DialogTitle>
                    <DialogDescription>
                      创建一个新的用户账户
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">邮箱</Label>
                      <Input
                        id="email"
                        type="email"
                        value={createUserForm.email}
                        onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="输入邮箱地址"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">密码</Label>
                      <Input
                        id="password"
                        type="password"
                        value={createUserForm.password}
                        onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="输入密码"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">姓名</Label>
                      <Input
                        id="full_name"
                        value={createUserForm.full_name}
                        onChange={(e) => setCreateUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="输入姓名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">角色</Label>
                      <Select 
                        value={createUserForm.role} 
                        onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role: value as UserRole }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">系统管理员</SelectItem>
                          <SelectItem value="finance">财务人员</SelectItem>
                          <SelectItem value="business">业务人员</SelectItem>
                          <SelectItem value="operator">操作员</SelectItem>
                          <SelectItem value="viewer">查看者</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateUser} className="flex-1">
                        创建用户
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
                        取消
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无用户数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === users.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSelectionChange(users.map(u => u.id));
                        } else {
                          onSelectionChange([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>用户信息</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>权限统计</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onSelectionChange([...selectedUsers, user.id]);
                          } else {
                            onSelectionChange(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          启用
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-700 border-red-300">
                          <XCircle className="h-3 w-3 mr-1" />
                          禁用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getPermissionCount(user)} 个权限</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(user)}
                          title={user.is_active ? "禁用用户" : "启用用户"}
                        >
                          {user.is_active ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="编辑用户"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="删除用户"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 确认用户状态变更对话框 */}
      <Dialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认用户状态变更</DialogTitle>
            <DialogDescription>
              确定要{userToDelete?.is_active ? '禁用' : '启用'}用户 "{userToDelete?.full_name}" 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button onClick={confirmToggleUserStatus} className="flex-1">
              确认
            </Button>
            <Button variant="outline" onClick={() => setShowStatusChangeDialog(false)}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量角色变更对话框 */}
      <Dialog open={showBulkRoleDialog} onOpenChange={setShowBulkRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量角色变更</DialogTitle>
            <DialogDescription>
              为选中的 {selectedUsers.length} 个用户设置新角色
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk_role">新角色</Label>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">系统管理员</SelectItem>
                  <SelectItem value="finance">财务人员</SelectItem>
                  <SelectItem value="business">业务人员</SelectItem>
                  <SelectItem value="operator">操作员</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBulkRoleChange} className="flex-1" disabled={!bulkRole}>
                确认变更
              </Button>
              <Button variant="outline" onClick={() => setShowBulkRoleDialog(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedUsers.length} 个用户吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button onClick={handleBulkDelete} className="flex-1" variant="destructive">
              确认删除
            </Button>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
