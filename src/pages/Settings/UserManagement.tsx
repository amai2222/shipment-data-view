import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Copy, Key, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, UserRole, UserProfile } from "@/contexts/AuthContext";

interface CreateUserData {
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  password: string;
  work_wechat_userid?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    email: '',
    username: '',
    full_name: '',
    role: 'operator',
    password: '',
    work_wechat_userid: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();
  const { profile: me } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // 优化查询：只获取必要字段，添加索引优化
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, username, full_name, role, is_active, created_at, work_wechat_userid')
        .order('created_at', { ascending: false })
        .limit(100); // 限制查询数量

      if (error) {
        toast({
          title: "获取用户列表失败",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setUsers(data.map(user => ({
          id: user.id,
          email: user.email || '',
          username: user.username || user.email || '',
          full_name: user.full_name || '',
          role: user.role as UserRole,
          is_active: user.is_active ?? true,
          work_wechat_userid: user.work_wechat_userid
        })));
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createUserData.email || !createUserData.password || !createUserData.username) {
      toast({
        title: "创建失败",
        description: "请填写完整信息",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 创建用户账户
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createUserData.email,
        password: createUserData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: createUserData.username,
            full_name: createUserData.full_name
          }
        }
      });

      if (authError) {
        toast({
          title: "创建用户失败",
          description: authError.message,
          variant: "destructive",
        });
        return;
      }

      if (authData.user) {
        // 更新用户配置
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: createUserData.username,
            full_name: createUserData.full_name,
            role: createUserData.role,
            work_wechat_userid: createUserData.work_wechat_userid || null
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('更新用户配置失败:', profileError);
        }
      }

      toast({
        title: "创建成功",
        description: "用户创建成功",
      });

      setIsCreateDialogOpen(false);
      setCreateUserData({
        email: '',
        username: '',
        full_name: '',
        role: 'operator',
        password: '',
        work_wechat_userid: ''
      });
      fetchUsers();
    } catch (error) {
      console.error('创建用户失败:', error);
      toast({
        title: "创建失败",
        description: "创建用户时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUser = (user: UserProfile) => {
    setCreateUserData({
      email: '',
      username: '',
      full_name: user.full_name,
      role: user.role,
      password: '',
      work_wechat_userid: user.work_wechat_userid || ''
    });
    setIsCreateDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) {
      toast({
        title: "修改失败",
        description: "请输入新密码",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId: selectedUser.id,
          newPassword,
        },
      });

      if (error) {
        toast({ title: '修改失败', description: error.message, variant: 'destructive' });
        return;
      }

      toast({ title: '修改成功', description: '密码已更新' });
      setIsPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      console.error('修改密码失败:', error);
      toast({ title: '修改失败', description: '修改密码时发生错误', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = (user: UserProfile) => {
    setSelectedUser(user);
    setIsStatusChangeDialogOpen(true);
  };

  const confirmToggleUserStatus = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !selectedUser.is_active })
        .eq('id', selectedUser.id);

      if (error) {
        toast({
          title: "操作失败",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "操作成功",
        description: `用户已${selectedUser.is_active ? '禁用' : '启用'}`,
      });

      // 只更新状态，避免重新获取所有数据
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id ? { ...u, is_active: !selectedUser.is_active } : u
      ));

      setIsStatusChangeDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      
      // 首先删除用户权限
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.id);

      // 然后删除用户档案
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) {
        toast({
          title: "删除失败",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "删除成功",
        description: `用户 ${selectedUser.full_name || selectedUser.username} 已被删除`,
      });

      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      
      // 重新获取用户列表
      await fetchUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      toast({
        title: "删除失败",
        description: "删除用户失败，请重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
        
      if (error) {
        toast({ title: '更新失败', description: error.message, variant: 'destructive' });
        return;
      }
      
      toast({ title: '更新成功', description: '角色已更新' });
      
      // 只更新状态，避免重新获取所有数据
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role } : u
      ));
    } catch (e) {
      console.error('更新角色失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    const roleMap = {
      admin: '管理员',
      finance: '财务',
      business: '业务',
      operator: '操作员',
      partner: '合作方',
      viewer: '查看组'
    };
    return roleMap[role] || role;
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    const variantMap = {
      admin: 'destructive',
      finance: 'default',
      business: 'secondary',
      operator: 'outline',
      partner: 'default',
      viewer: 'secondary'
    } as const;
    return variantMap[role] || 'default';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">用户管理</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              新建用户
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>创建新用户</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="请输入邮箱地址"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={createUserData.username}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="请输入用户名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">姓名</Label>
                <Input
                  id="full_name"
                  value={createUserData.full_name}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="请输入真实姓名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">角色</Label>
                <Select value={createUserData.role} onValueChange={(value) => setCreateUserData(prev => ({ ...prev, role: value as UserRole }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="finance">财务</SelectItem>
                    <SelectItem value="business">业务</SelectItem>
                    <SelectItem value="operator">操作员</SelectItem>
                    <SelectItem value="partner">合作方</SelectItem>
                    <SelectItem value="viewer">查看组</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_wechat_userid">企业微信UserID（可选）</Label>
                <Input
                  id="work_wechat_userid"
                  value={createUserData.work_wechat_userid || ''}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, work_wechat_userid: e.target.value }))}
                  placeholder="请输入企业微信UserID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="请输入密码"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateUser} disabled={loading} className="flex-1">
                  {loading ? '创建中...' : '创建用户'}
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>企业微信</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleUpdateRole(user.id, value as UserRole)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder={getRoleLabel(user.role)} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="finance">财务</SelectItem>
                        <SelectItem value="business">业务</SelectItem>
                        <SelectItem value="operator">操作员</SelectItem>
                        <SelectItem value="partner">合作方</SelectItem>
                        <SelectItem value="viewer">查看组</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.work_wechat_userid ? (
                      <Badge variant="secondary" className="text-xs">
                        已关联
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">未关联</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyUser(user)}
                        title="复制用户"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsPasswordDialogOpen(true);
                        }}
                        title="修改密码"
                      >
                        <Key className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant={user.is_active ? "secondary" : "default"}
                        onClick={() => handleToggleUserStatus(user)}
                        title={user.is_active ? "禁用用户" : "启用用户"}
                      >
                        {user.is_active ? "禁用" : "启用"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteDialogOpen(true);
                        }}
                        title="删除用户"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改用户密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户</Label>
              <div className="p-2 bg-muted rounded">
                {selectedUser?.username} ({selectedUser?.email})
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleChangePassword} disabled={loading} className="flex-1">
                {loading ? '修改中...' : '修改密码'}
              </Button>
              <Button variant="outline" onClick={() => {
                setIsPasswordDialogOpen(false);
                setNewPassword('');
                setSelectedUser(null);
              }}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>确认删除用户</Label>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium">{selectedUser?.full_name || selectedUser?.username}</div>
                <div className="text-sm text-muted-foreground">{selectedUser?.email}</div>
                <div className="text-sm text-muted-foreground">角色: {getRoleLabel(selectedUser?.role || 'viewer')}</div>
              </div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>警告：</strong>删除用户将同时删除：
                <ul className="mt-2 ml-4 list-disc">
                  <li>用户的所有权限设置</li>
                  <li>用户创建的数据记录</li>
                  <li>用户的所有操作日志</li>
                </ul>
                <p className="mt-2">此操作不可撤销！</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleDeleteUser} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? '删除中...' : '确认删除'}
              </Button>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusChangeDialogOpen} onOpenChange={setIsStatusChangeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认用户状态变更</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户信息</Label>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium">{selectedUser?.full_name || selectedUser?.username}</div>
                <div className="text-sm text-muted-foreground">{selectedUser?.email}</div>
                <div className="text-sm text-muted-foreground">角色: {getRoleLabel(selectedUser?.role || 'viewer')}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>状态变更</Label>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>当前状态：</strong>
                  <Badge variant={selectedUser?.is_active ? 'default' : 'secondary'} className="ml-2">
                    {selectedUser?.is_active ? '启用' : '禁用'}
                  </Badge>
                </div>
                <div className="text-sm text-blue-800 mt-2">
                  <strong>变更后：</strong>
                  <Badge variant={selectedUser?.is_active ? 'secondary' : 'default'} className="ml-2">
                    {selectedUser?.is_active ? '禁用' : '启用'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <strong>注意：</strong>
                {selectedUser?.is_active ? (
                  <span>禁用用户后，该用户将无法登录系统。</span>
                ) : (
                  <span>启用用户后，该用户将可以正常登录系统。</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={selectedUser?.is_active ? "secondary" : "default"}
                onClick={confirmToggleUserStatus} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? '处理中...' : `确认${selectedUser?.is_active ? '禁用' : '启用'}`}
              </Button>
              <Button variant="outline" onClick={() => setIsStatusChangeDialogOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}