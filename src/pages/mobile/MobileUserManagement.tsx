import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Edit3, Users, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from "@/components/ui/scroll-area";
import { MobileLayout } from '@/components/mobile/MobileLayout';

const ROLES = [
  { value: 'admin', label: '系统管理员', color: 'bg-red-500' },
  { value: 'finance', label: '财务人员', color: 'bg-blue-500' },
  { value: 'business', label: '业务人员', color: 'bg-green-500' },
  { value: 'operator', label: '操作员', color: 'bg-yellow-500' },
  { value: 'partner', label: '合作方', color: 'bg-purple-500' },
  { value: 'viewer', label: '查看者', color: 'bg-gray-500' }
];

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  username?: string;
  created_at: string;
}

export default function MobileUserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    role: 'operator' as const,
    is_active: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, username, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setUsers(data || []);
    } catch (error) {
      console.error('加载用户失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载用户列表",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      username: user.username || '',
      role: user.role as any,
      is_active: user.is_active
    });
    setIsEditDialogOpen(true);
  };

  const handleAddUser = () => {
    setFormData({
      full_name: '',
      email: '',
      username: '',
      role: 'operator',
      is_active: true
    });
    setIsAddDialogOpen(true);
  };

  const saveUser = async () => {
    try {
      if (selectedUser) {
        // 更新用户
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            username: formData.username,
            is_active: formData.is_active
          })
          .eq('id', selectedUser.id);

        if (error) throw error;

        toast({
          title: "更新成功",
          description: "用户信息已更新",
        });
      } else {
        // 这里应该调用创建用户的API
        toast({
          title: "提示",
          description: "用户创建功能需要后端支持",
        });
      }

      setIsEditDialogOpen(false);
      setIsAddDialogOpen(false);
      loadUsers();
    } catch (error) {
      console.error('保存用户失败:', error);
      toast({
        title: "保存失败",
        description: "无法保存用户信息",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleInfo = (role: string) => {
    return ROLES.find(r => r.value === role) || ROLES[3];
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">加载中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">用户管理</h1>
              <p className="text-sm text-muted-foreground">管理系统用户和权限</p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary" onClick={handleAddUser}>
                <UserPlus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md">
              <DialogHeader>
                <DialogTitle>添加用户</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name">姓名</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="请输入用户姓名"
                  />
                </div>
                <div>
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="请输入邮箱地址"
                  />
                </div>
                <div>
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="请输入用户名（可选）"
                  />
                </div>
                <div>
                  <Label htmlFor="role">角色</Label>
                  <Select value={formData.role} onValueChange={(value: any) => setFormData(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={saveUser} className="bg-gradient-primary">
                    保存
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 用户列表 */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3">
            {filteredUsers.map(user => {
              const roleInfo = getRoleInfo(user.role);
              return (
                <Card key={user.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground truncate">
                            {user.full_name || '未设置姓名'}
                          </h3>
                          {!user.is_active && (
                            <Badge variant="outline" className="text-xs">
                              已禁用
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary"
                            className={`text-xs text-white ${roleInfo.color}`}
                          >
                            {roleInfo.label}
                          </Badge>
                          {user.username && (
                            <span className="text-xs text-muted-foreground">
                              @{user.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        {/* 编辑用户对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_full_name">姓名</Label>
                <Input
                  id="edit_full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="请输入用户姓名"
                />
              </div>
              <div>
                <Label htmlFor="edit_username">用户名</Label>
                <Input
                  id="edit_username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="请输入用户名（可选）"
                />
              </div>
              <div>
                <Label htmlFor="edit_role">角色</Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="edit_is_active">用户状态激活</Label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={saveUser} className="bg-gradient-primary">
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}