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
import { UserRole, UserProfile } from "@/contexts/AuthContext";

interface CreateUserData {
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  password: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    email: '',
    username: '',
    full_name: '',
    role: 'operator',
    password: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "获取用户列表失败",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setUsers(data.map(user => ({
        id: user.id,
        email: user.email || '',
        username: (user as any).username || user.email || '',
        full_name: user.full_name || '',
        role: user.role as UserRole,
        is_active: (user as any).is_active ?? true
      })));
    } catch (error) {
      console.error('获取用户列表失败:', error);
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
            role: createUserData.role
          } as any)
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
        password: ''
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
      password: ''
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
      // 注意：在实际应用中，修改其他用户密码通常需要管理员权限的特殊API
      // 这里简化处理，实际应该通过管理员API来重置密码
      toast({
        title: "功能提示",
        description: "密码修改功能需要后端管理员API支持",
        variant: "default",
      });
      
      setIsPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      console.error('修改密码失败:', error);
      toast({
        title: "修改失败",
        description: "修改密码时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: UserProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active } as any)
        .eq('id', user.id);

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
        description: `用户已${user.is_active ? '禁用' : '启用'}`,
      });

      fetchUsers();
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    const roleMap = {
      admin: '管理员',
      finance: '财务',
      business: '业务',
      operator: '操作员',
      partner: '合作方'
    };
    return roleMap[role] || role;
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    const variantMap = {
      admin: 'destructive',
      finance: 'default',
      business: 'secondary',
      operator: 'outline',
      partner: 'default'
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
                  </SelectContent>
                </Select>
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
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
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
                      >
                        <Key className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant={user.is_active ? "destructive" : "default"}
                        onClick={() => handleToggleUserStatus(user)}
                      >
                        {user.is_active ? <Trash2 className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
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
    </div>
  );
}