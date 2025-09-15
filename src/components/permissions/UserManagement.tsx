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
import { DynamicRoleService } from '@/services/DynamicRoleService';
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
import { EnterpriseUserEditDialog } from '../EnterpriseUserEditDialog';
import { PermissionChangeConfirmDialog } from '../PermissionChangeConfirmDialog';
import { ChangePasswordDialog } from '../ChangePasswordDialog';
import { ProjectAssignmentManager } from '../ProjectAssignmentManager';
import { PermissionCalculationService } from '@/services/PermissionCalculationService';

interface UserManagementProps {
  users: UserWithPermissions[];
  loading: boolean;
  selectedUsers: string[];
  onSelectionChange: (selected: string[]) => void;
  onUserUpdate: () => void;
  roleTemplates?: Record<string, any>;
}

export function UserManagement({ 
  users, 
  loading, 
  selectedUsers, 
  onSelectionChange, 
  onUserUpdate,
  roleTemplates = {}
}: UserManagementProps) {
  const { toast } = useToast();
  
  // 角色名称映射
  const roleNameMap: Record<string, string> = {
    admin: '系统管理员',
    finance: '财务人员',
    business: '业务人员',
    operator: '操作员',
    partner: '合作伙伴',
    viewer: '查看者'
  };
  
  // 状态管理
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [showBulkRoleDialog, setShowBulkRoleDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithPermissions | null>(null);
  const [bulkRole, setBulkRole] = useState('');
  
  // 企业级编辑功能
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const [showPermissionConfirmDialog, setShowPermissionConfirmDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] = useState<UserWithPermissions | null>(null);
  
  // 项目分配功能
  const [showProjectAssignmentDialog, setShowProjectAssignmentDialog] = useState(false);
  const [projectAssignmentUser, setProjectAssignmentUser] = useState<UserWithPermissions | null>(null);
  
  // 表单数据
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'viewer' as UserRole
  });

  // 打开编辑用户对话框
  const handleEditUser = (user: UserWithPermissions) => {
    setEditingUser(user);
    setShowEditDialog(true);
  };

  // 修改密码
  const handleChangePassword = (user: UserWithPermissions) => {
    setPasswordChangeUser(user);
    setShowChangePasswordDialog(true);
  };

  // 关闭修改密码弹窗
  const handleCloseChangePasswordDialog = () => {
    setShowChangePasswordDialog(false);
    setPasswordChangeUser(null);
  };

  // 打开项目分配对话框
  const handleProjectAssignment = (user: UserWithPermissions) => {
    setProjectAssignmentUser(user);
    setShowProjectAssignmentDialog(true);
  };

  // 关闭项目分配对话框
  const handleCloseProjectAssignmentDialog = () => {
    setShowProjectAssignmentDialog(false);
    setProjectAssignmentUser(null);
  };

  // 保存用户编辑
  const handleSaveUserEdit = (updatedUser: UserWithPermissions) => {
    // 记录变更
    const changes = [];
    
    if (updatedUser.full_name !== editingUser?.full_name) {
      changes.push({
        type: 'user_info',
        userId: updatedUser.id,
        userName: updatedUser.full_name,
        oldValue: editingUser?.full_name,
        newValue: updatedUser.full_name,
        description: `修改用户姓名: ${editingUser?.full_name} → ${updatedUser.full_name}`
      });
    }
    
    if (updatedUser.role !== editingUser?.role) {
      changes.push({
        type: 'user_role',
        userId: updatedUser.id,
        userName: updatedUser.full_name,
        oldValue: editingUser?.role,
        newValue: updatedUser.role,
        description: `修改用户角色: ${editingUser?.role} → ${updatedUser.role}`
      });
    }
    
    if (updatedUser.is_active !== editingUser?.is_active) {
      changes.push({
        type: 'user_status',
        userId: updatedUser.id,
        userName: updatedUser.full_name,
        oldValue: editingUser?.is_active,
        newValue: updatedUser.is_active,
        description: `修改用户状态: ${editingUser?.is_active ? '启用' : '禁用'} → ${updatedUser.is_active ? '启用' : '禁用'}`
      });
    }

    if (changes.length > 0) {
      setPendingChanges(changes);
      setShowPermissionConfirmDialog(true);
    } else {
      onUserUpdate();
    }
  };

  // 确认权限变更
  const handleConfirmPermissionChanges = () => {
    setShowPermissionConfirmDialog(false);
    onUserUpdate();
    toast({
      title: "变更成功",
      description: "用户信息已更新并立即生效",
    });
  };

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

  // 删除单个用户
  const handleDeleteUser = (user: UserWithPermissions) => {
    setUserToDelete(user);
    setShowSingleDeleteDialog(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: `用户 "${userToDelete.full_name}" 已删除`,
      });

      setShowSingleDeleteDialog(false);
      setUserToDelete(null);
      onUserUpdate();
    } catch (error: any) {
      console.error('删除用户失败:', error);
      toast({
        title: "删除失败",
        description: "删除用户失败",
        variant: "destructive"
      });
    }
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

  // 获取权限统计（包括项目分配）
  const getPermissionCount = (user: UserWithPermissions) => {
    // 获取用户角色的基础权限模板
    const roleTemplate = roleTemplates[user.role];
    
    // 计算实际生效的权限数量（用户自定义权限优先，否则使用角色模板权限）
    const effectivePermissions = {
      menu: user.permissions?.menu || roleTemplate?.menu_permissions || [],
      function: user.permissions?.function || roleTemplate?.function_permissions || [],
      project: user.permissions?.project || roleTemplate?.project_permissions || [],
      data: user.permissions?.data || roleTemplate?.data_permissions || []
    };
    
    // 计算基础权限数量
    const basePermissions = (
      effectivePermissions.menu.length +
      effectivePermissions.function.length +
      effectivePermissions.project.length +
      effectivePermissions.data.length
    );
    
    // 注意：项目分配权限是额外的，会通过 PermissionCalculationService 异步计算
    // 这里返回基础权限数量，实际显示的总数会在组件加载时通过服务计算
    
    return basePermissions;
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
                          {DynamicRoleService.generateRoleSelectOptions().map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full ${option.color} mr-2`} />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
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
                  <TableHead>手机号</TableHead>
                <TableHead>企业微信</TableHead>
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
                      <Badge variant="outline">{roleNameMap[user.role] || user.role}</Badge>
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
                      {(user as any).phone ? (
                        <span className="text-sm">{(user as any).phone}</span>
                      ) : (
                        <span className="text-sm text-gray-400">未设置</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(user as any).work_wechat_userid ? (
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          <Building2 className="h-3 w-3 mr-1" />
                          已关联
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 border-gray-300">
                          <Building2 className="h-3 w-3 mr-1" />
                          未关联
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserStatus(user)}
                          className={user.is_active ? "text-red-600 border-red-300 hover:bg-red-50" : "text-green-600 border-green-300 hover:bg-green-50"}
                        >
                          {user.is_active ? "禁用" : "启用"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChangePassword(user)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          修改密码
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProjectAssignment(user)}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <Building2 className="h-4 w-4 mr-1" />
                          项目分配
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          删除
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
                  {DynamicRoleService.generateRoleSelectOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${option.color} mr-2`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
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

      {/* 单个用户删除确认对话框 */}
      <Dialog open={showSingleDeleteDialog} onOpenChange={setShowSingleDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除用户</DialogTitle>
            <DialogDescription>
              确定要删除用户 "{userToDelete?.full_name}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button onClick={confirmDeleteUser} className="flex-1" variant="destructive">
              确认删除
            </Button>
            <Button variant="outline" onClick={() => setShowSingleDeleteDialog(false)}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 企业级用户编辑对话框 */}
      <EnterpriseUserEditDialog
        user={editingUser}
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUserEdit}
      />

      {/* 权限变更确认对话框 */}
      <PermissionChangeConfirmDialog
        isOpen={showPermissionConfirmDialog}
        onClose={() => setShowPermissionConfirmDialog(false)}
        onConfirm={handleConfirmPermissionChanges}
        changes={pendingChanges}
      />

      {/* 修改密码对话框 */}
      <ChangePasswordDialog
        isOpen={showChangePasswordDialog}
        onClose={handleCloseChangePasswordDialog}
        userId={passwordChangeUser?.id || ''}
        userName={passwordChangeUser?.full_name || ''}
        onSuccess={() => {
          toast({
            title: "密码修改成功",
            description: "用户密码已更新",
          });
        }}
      />

      {/* 项目分配对话框 */}
      <Dialog open={showProjectAssignmentDialog} onOpenChange={setShowProjectAssignmentDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              项目分配管理
            </DialogTitle>
            <DialogDescription>
              管理用户 {projectAssignmentUser?.full_name} 的项目访问权限
            </DialogDescription>
          </DialogHeader>
          {projectAssignmentUser && (
            <ProjectAssignmentManager
              userId={projectAssignmentUser.id}
              userName={projectAssignmentUser.full_name}
              userRole={projectAssignmentUser.role}
              onAssignmentChange={() => {
                onUserUpdate();
                toast({
                  title: "项目分配更新",
                  description: "项目分配已更新",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
